-- -------------------------------------------------------------
-- TablePlus 7.1.0(710)
--
-- https://tableplus.com/
--
-- Database: neondb
-- Generation Time: 2026-06-06 16:03:23.6170
-- -------------------------------------------------------------


DROP TABLE IF EXISTS "public"."customers";
-- Sequence and defined type
CREATE SEQUENCE IF NOT EXISTS customers_id_seq;

-- Table Definition
CREATE TABLE "public"."customers" (
    "id" int8 NOT NULL DEFAULT nextval('customers_id_seq'::regclass),
    "name" varchar(255) NOT NULL,
    "phone" varchar(50),
    "email" varchar(255),
    "type" varchar(100),
    "address" text,
    "notes" text,
    "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("id")
);

DROP TABLE IF EXISTS "public"."leads";
-- Sequence and defined type
CREATE SEQUENCE IF NOT EXISTS leads_id_seq;

-- Table Definition
CREATE TABLE "public"."leads" (
    "id" int8 NOT NULL DEFAULT nextval('leads_id_seq'::regclass),
    "customer_id" int8,
    "pic_id" int8,
    "lead_date" date NOT NULL,
    "source" varchar(100) NOT NULL,
    "status" varchar(50) NOT NULL,
    "tags" varchar(255),
    "notes" text,
    "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("id")
);

DROP TABLE IF EXISTS "public"."users";
-- Sequence and defined type
CREATE SEQUENCE IF NOT EXISTS users_id_seq;

-- Table Definition
CREATE TABLE "public"."users" (
    "id" int8 NOT NULL DEFAULT nextval('users_id_seq'::regclass),
    "name" varchar(255) NOT NULL,
    "email" varchar(255) NOT NULL,
    "password_hash" varchar(255) NOT NULL,
    "role" varchar(50) NOT NULL,
    "status" varchar(50) DEFAULT 'Aktif'::character varying,
    "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("id")
);

DROP TABLE IF EXISTS "public"."product_categories";
-- Sequence and defined type
CREATE SEQUENCE IF NOT EXISTS product_categories_id_seq;

-- Table Definition
CREATE TABLE "public"."product_categories" (
    "id" int8 NOT NULL DEFAULT nextval('product_categories_id_seq'::regclass),
    "name" varchar(100) NOT NULL,
    "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("id")
);

DROP TABLE IF EXISTS "public"."products";
-- Sequence and defined type
CREATE SEQUENCE IF NOT EXISTS products_id_seq;

-- Table Definition
CREATE TABLE "public"."products" (
    "id" int8 NOT NULL DEFAULT nextval('products_id_seq'::regclass),
    "name" varchar(255) NOT NULL,
    "category_id" int8,
    "description" text,
    "price" numeric(15,2) NOT NULL,
    "status" varchar(50) DEFAULT 'Aktif'::character varying,
    "image_url" text,
    "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("id")
);

DROP TABLE IF EXISTS "public"."recipes";
-- Sequence and defined type
CREATE SEQUENCE IF NOT EXISTS recipes_id_seq;

-- Table Definition
CREATE TABLE "public"."recipes" (
    "id" int8 NOT NULL DEFAULT nextval('recipes_id_seq'::regclass),
    "product_id" int8,
    "menu_name" varchar(255) NOT NULL,
    "ingredients" text NOT NULL,
    "standard_cost" numeric(15,2) NOT NULL,
    "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("id")
);

DROP TABLE IF EXISTS "public"."orders";
-- Sequence and defined type
CREATE SEQUENCE IF NOT EXISTS orders_id_seq;

-- Table Definition
CREATE TABLE "public"."orders" (
    "id" int8 NOT NULL DEFAULT nextval('orders_id_seq'::regclass),
    "customer_id" int8,
    "lead_id" int8,
    "pic_id" int8,
    "order_date" date NOT NULL,
    "delivery_date" date NOT NULL,
    "departure_time" time,
    "arrival_time" time,
    "venue" text,
    "order_notes" text,
    "status_order" varchar(50) DEFAULT 'Baru'::character varying,
    "status_payment" varchar(50) DEFAULT 'Belum Lunas'::character varying,
    "grand_total" numeric(15,2) DEFAULT 0,
    "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("id")
);

DROP TABLE IF EXISTS "public"."order_items";
-- Sequence and defined type
CREATE SEQUENCE IF NOT EXISTS order_items_id_seq;

-- Table Definition
CREATE TABLE "public"."order_items" (
    "id" int8 NOT NULL DEFAULT nextval('order_items_id_seq'::regclass),
    "order_id" int8,
    "product_id" int8,
    "custom_menu" text,
    "price" numeric(15,2) NOT NULL,
    "quantity" int4 NOT NULL DEFAULT 1,
    "discount" numeric(15,2) DEFAULT 0,
    "subtotal" numeric(15,2) NOT NULL,
    "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("id")
);

DROP TABLE IF EXISTS "public"."production_schedules";
-- Sequence and defined type
CREATE SEQUENCE IF NOT EXISTS production_schedules_id_seq;

-- Table Definition
CREATE TABLE "public"."production_schedules" (
    "id" int8 NOT NULL DEFAULT nextval('production_schedules_id_seq'::regclass),
    "chef_id" int8,
    "target_date" date NOT NULL,
    "total_revenue" numeric(15,2) DEFAULT 0,
    "budget_limit" numeric(15,2) DEFAULT 0,
    "total_estimated_hpp" numeric(15,2) DEFAULT 0,
    "status" varchar(50) DEFAULT 'Draft'::character varying,
    "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("id")
);

DROP TABLE IF EXISTS "public"."schedule_orders";
-- Table Definition
CREATE TABLE "public"."schedule_orders" (
    "schedule_id" int8 NOT NULL,
    "order_id" int8 NOT NULL,
    PRIMARY KEY ("schedule_id","order_id")
);

DROP TABLE IF EXISTS "public"."schedule_menus";
-- Sequence and defined type
CREATE SEQUENCE IF NOT EXISTS schedule_menus_id_seq;

-- Table Definition
CREATE TABLE "public"."schedule_menus" (
    "id" int8 NOT NULL DEFAULT nextval('schedule_menus_id_seq'::regclass),
    "schedule_id" int8,
    "recipe_id" int8,
    "quantity_pax" int4 NOT NULL,
    "hpp_subtotal" numeric(15,2) NOT NULL,
    "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("id")
);

DROP TABLE IF EXISTS "public"."purchase_requests";
-- Sequence and defined type
CREATE SEQUENCE IF NOT EXISTS purchase_requests_id_seq;

-- Table Definition
CREATE TABLE "public"."purchase_requests" (
    "id" int8 NOT NULL DEFAULT nextval('purchase_requests_id_seq'::regclass),
    "schedule_id" int8,
    "chef_id" int8,
    "total_pr_value" numeric(15,2) DEFAULT 0,
    "status" varchar(50) DEFAULT 'Draft'::character varying,
    "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("id")
);

DROP TABLE IF EXISTS "public"."pr_items";
-- Sequence and defined type
CREATE SEQUENCE IF NOT EXISTS pr_items_id_seq;

-- Table Definition
CREATE TABLE "public"."pr_items" (
    "id" int8 NOT NULL DEFAULT nextval('pr_items_id_seq'::regclass),
    "pr_id" int8,
    "item_name" varchar(255) NOT NULL,
    "quantity" numeric(10,2) NOT NULL,
    "uom" varchar(50) NOT NULL,
    "estimated_price" numeric(15,2) NOT NULL,
    "subtotal" numeric(15,2) NOT NULL,
    "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("id")
);

DROP TABLE IF EXISTS "public"."purchase_orders";
-- Sequence and defined type
CREATE SEQUENCE IF NOT EXISTS purchase_orders_id_seq;

-- Table Definition
CREATE TABLE "public"."purchase_orders" (
    "id" int8 NOT NULL DEFAULT nextval('purchase_orders_id_seq'::regclass),
    "pr_id" int8,
    "purchasing_id" int8,
    "finance_id" int8,
    "po_date" date NOT NULL,
    "total_actual_cost" numeric(15,2) DEFAULT 0,
    "status_po" varchar(50) DEFAULT 'Diproses'::character varying,
    "status_cost" varchar(50) DEFAULT 'Pending'::character varying,
    "variance_notes" text,
    "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("id")
);

DROP TABLE IF EXISTS "public"."overheads";
-- Sequence and defined type
CREATE SEQUENCE IF NOT EXISTS overheads_id_seq;

-- Table Definition
CREATE TABLE "public"."overheads" (
    "id" int8 NOT NULL DEFAULT nextval('overheads_id_seq'::regclass),
    "finance_id" int8,
    "expense_date" date NOT NULL,
    "category" varchar(100) NOT NULL,
    "amount" numeric(15,2) NOT NULL,
    "notes" text,
    "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("id")
);

INSERT INTO "public"."customers" ("id", "name", "phone", "email", "type", "address", "notes", "created_at", "updated_at") VALUES
(1, 'PT Maju Bersama', '08121000001', 'maju@co.com', 'Corporate', 'Jl. Sudirman No.1 Jakarta', NULL, '2026-05-27 08:50:52.507667', '2026-05-27 08:50:52.507667'),
(2, 'APTIKOM Jabar', '08121000002', 'aptikom@org.id', 'Instansi', 'Jl. Dipati Ukur No.35 Bandung', NULL, '2026-05-27 08:50:52.507667', '2026-05-27 08:50:52.507667'),
(3, 'Ressa Permata', '08121000003', 'ressa@gmail.com', 'Personal', 'Jl. Buah Batu No.22 Bandung', NULL, '2026-05-27 08:50:52.507667', '2026-05-27 08:50:52.507667'),
(4, 'Yayasan Nurul Iman', '08121000004', 'nurul@yas.org', 'Instansi', 'Jl. Pelajar No.8 Bandung', NULL, '2026-05-27 08:50:52.507667', '2026-05-27 08:50:52.507667'),
(5, 'Hotel Savoy Homann', '08121000005', 'savoy@hotel.com', 'Corporate', 'Jl. Asia Afrika Bandung', NULL, '2026-05-27 08:50:52.507667', '2026-05-27 08:50:52.507667'),
(6, 'Unpad', '08121000006', 'unpad@ac.id', 'Instansi', 'Jl. Raya Bandung-Sumedang', NULL, '2026-05-27 08:50:52.507667', '2026-05-27 08:50:52.507667'),
(7, 'Dinas Kesehatan Jabar', '08121000007', 'dinkes@jabar.go.id', 'Pemerintah', 'Jl. Pasteur No.25', NULL, '2026-05-27 08:50:52.507667', '2026-05-27 08:50:52.507667'),
(8, 'Komunitas PKK', '08121000008', 'pkk@bdg.go.id', 'Komunitas', 'Jl. Merdeka No.3 Bandung', NULL, '2026-05-27 08:50:52.507667', '2026-05-27 08:50:52.507667'),
(9, 'Hendra Wijaya', '08121000009', 'hendra@gmail.com', 'Personal', 'Jl. Setiabudi No.11', NULL, '2026-05-27 08:50:52.507667', '2026-05-27 08:50:52.507667'),
(10, 'CV Kreatif Digital', '08121000010', 'kreatif@digi.com', 'Corporate', 'Jl. Industri No.5', NULL, '2026-05-27 08:50:52.507667', '2026-05-27 08:50:52.507667'),
(12, 'Kurniawan Perkasa', '081299998888', NULL, 'Personal', NULL, NULL, '2026-05-27 09:44:40.863868', '2026-05-27 09:44:40.863868');

INSERT INTO "public"."leads" ("id", "customer_id", "pic_id", "lead_date", "source", "status", "tags", "notes", "created_at", "updated_at") VALUES
(1, 1, 1, '2026-04-28', 'WhatsApp', 'Closing', 'repeat,korporat', 'Deal confirmed', '2026-05-27 08:50:52.532755', '2026-05-27 08:50:52.532755'),
(2, 3, 1, '2026-04-29', 'Instagram', 'Closing', 'pernikahan', 'Prasmanan VIP 150pax', '2026-05-27 08:50:52.532755', '2026-05-27 08:50:52.532755'),
(3, 5, 1, '2026-04-30', 'Referral', 'Closing', 'hotel,vip', 'Gala dinner', '2026-05-27 08:50:52.532755', '2026-05-27 08:50:52.532755'),
(4, 2, 1, '2026-05-01', 'Website', 'Follow Up', 'instansi', 'Nunggu approval', '2026-05-27 08:50:52.532755', '2026-05-27 08:50:52.532755'),
(5, 4, 1, '2026-05-02', 'WhatsApp', 'Negosiasi', 'yayasan', 'Minta diskon 10%', '2026-05-27 08:50:52.532755', '2026-05-27 08:50:52.532755'),
(6, 6, 1, '2026-05-03', 'Referral', 'Closing', 'universitas', 'Wisuda S2 500 box', '2026-05-27 08:50:52.532755', '2026-05-27 08:50:52.532755'),
(7, 7, 1, '2026-05-04', 'Website', 'Follow Up', 'pemerintah', 'Perlu SPK dulu', '2026-05-27 08:50:52.532755', '2026-05-27 08:50:52.532755'),
(8, 8, 1, '2026-05-05', 'WhatsApp', 'Closing', 'komunitas', 'Order mingguan OK', '2026-05-27 08:50:52.532755', '2026-05-27 08:50:52.532755'),
(9, 9, 1, '2026-05-06', 'Instagram', 'Prospek', 'personal', 'Masih survei', '2026-05-27 08:50:52.532755', '2026-05-27 08:50:52.532755'),
(10, 10, 1, '2026-05-07', 'Website', 'Follow Up', 'startup', 'Nanya harga', '2026-05-27 08:50:52.532755', '2026-05-27 08:50:52.532755'),
(11, 1, 1, '2026-05-08', 'WhatsApp', 'Closing', 'repeat', 'Order ke-3 bulan ini', '2026-05-27 08:50:52.532755', '2026-05-27 08:50:52.532755'),
(12, 3, 1, '2026-05-09', 'Referral', 'Negosiasi', 'pernikahan', 'Nego jumlah pax', '2026-05-27 08:50:52.532755', '2026-05-27 08:50:52.532755'),
(13, 5, 1, '2026-05-10', 'Website', 'Follow Up', 'hotel', 'Tunggu event', '2026-05-27 08:50:52.532755', '2026-05-27 08:50:52.532755'),
(14, 2, 1, '2026-05-11', 'WhatsApp', 'Closing', 'instansi', 'SPK sudah turun', '2026-05-27 08:50:52.532755', '2026-05-27 08:50:52.532755'),
(15, 4, 1, '2026-05-12', 'Instagram', 'Prospek', 'yayasan', 'Pertimbangan', '2026-05-27 08:50:52.532755', '2026-05-27 08:50:52.532755'),
(16, 6, 1, '2026-05-13', 'Referral', 'Closing', 'universitas', 'Seminar 200 pax', '2026-05-27 08:50:52.532755', '2026-05-27 08:50:52.532755'),
(17, 7, 1, '2026-05-14', 'WhatsApp', 'Follow Up', 'pemerintah', 'Rapat koordinasi', '2026-05-27 08:50:52.532755', '2026-05-27 08:50:52.532755'),
(18, 8, 1, '2026-05-15', 'Instagram', 'Closing', 'komunitas', 'Rutin minggu ini', '2026-05-27 08:50:52.532755', '2026-05-27 08:50:52.532755'),
(19, 9, 1, '2026-05-16', 'Website', 'Reject', 'personal', 'Budget tidak cocok', '2026-05-27 08:50:52.532755', '2026-05-27 08:50:52.532755'),
(20, 10, 1, '2026-05-17', 'WhatsApp', 'Follow Up', 'startup', 'Coba sample', '2026-05-27 08:50:52.532755', '2026-05-27 08:50:52.532755'),
(21, 1, 1, '2026-05-18', 'Referral', 'Closing', 'repeat', 'Approved GM', '2026-05-27 08:50:52.532755', '2026-05-27 08:50:52.532755'),
(22, 3, 1, '2026-05-19', 'WhatsApp', 'Prospek', 'pernikahan', 'Survey lokasi', '2026-05-27 08:50:52.532755', '2026-05-27 08:50:52.532755'),
(23, 5, 1, '2026-05-20', 'Instagram', 'Follow Up', 'hotel', 'Pending Q2', '2026-05-27 08:50:52.532755', '2026-05-27 08:50:52.532755'),
(24, 2, 1, '2026-05-21', 'Website', 'Negosiasi', 'instansi', 'Nego harga', '2026-05-27 08:50:52.532755', '2026-05-27 08:50:52.532755'),
(25, 4, 1, '2026-05-22', 'Referral', 'Closing', 'yayasan', 'Deal lebaran', '2026-05-27 08:50:52.532755', '2026-05-27 08:50:52.532755'),
(26, 6, 1, '2026-05-23', 'WhatsApp', 'Follow Up', 'universitas', 'Tunggu dekan', '2026-05-27 08:50:52.532755', '2026-05-27 08:50:52.532755'),
(27, 7, 2, '2026-05-01', 'Instagram', 'Follow Up', 'pemerintah', 'Belum direspon', '2026-05-27 08:50:52.532755', '2026-05-27 08:50:52.532755'),
(28, 8, 2, '2026-05-03', 'WhatsApp', 'Closing', 'komunitas', '30 pax kecil', '2026-05-27 08:50:52.532755', '2026-05-27 08:50:52.532755'),
(29, 9, 2, '2026-05-05', 'Website', 'Prospek', 'personal', 'Lihat-lihat', '2026-05-27 08:50:52.532755', '2026-05-27 08:50:52.532755'),
(30, 10, 2, '2026-05-07', 'Referral', 'Negosiasi', 'startup', 'Cicil DP', '2026-05-27 08:50:52.532755', '2026-05-27 08:50:52.532755'),
(31, 1, 2, '2026-05-09', 'WhatsApp', 'Reject', 'korporat', 'Sudah vendor lain', '2026-05-27 08:50:52.532755', '2026-05-27 08:50:52.532755'),
(32, 3, 2, '2026-05-11', 'Instagram', 'Follow Up', 'pernikahan', 'Mau visit dapur', '2026-05-27 08:50:52.532755', '2026-05-27 08:50:52.532755'),
(33, 4, 2, '2026-05-13', 'Website', 'Closing', 'yayasan', 'Kecil tapi pasti', '2026-05-27 08:50:52.532755', '2026-05-27 08:50:52.532755'),
(34, 5, 2, '2026-05-15', 'WhatsApp', 'Prospek', 'hotel', 'Sales kontak', '2026-05-27 08:50:52.532755', '2026-05-27 08:50:52.532755'),
(35, 6, 2, '2026-05-17', 'Referral', 'Closing', 'universitas', '50 pax acara kecil', '2026-05-27 08:50:52.532755', '2026-05-27 08:50:52.532755'),
(36, 7, 2, '2026-05-19', 'Instagram', 'Follow Up', 'pemerintah', 'Ganti PIC', '2026-05-27 08:50:52.532755', '2026-05-27 08:50:52.532755'),
(37, 8, 2, '2026-05-21', 'WhatsApp', 'Negosiasi', 'komunitas', 'Nego frekuensi', '2026-05-27 08:50:52.532755', '2026-05-27 08:50:52.532755'),
(38, 9, 2, '2026-05-22', 'Website', 'Reject', 'personal', 'Terlalu mahal', '2026-05-27 08:50:52.532755', '2026-05-27 08:50:52.532755'),
(39, 10, 2, '2026-05-23', 'Referral', 'Prospek', 'startup', 'Ngobrol awal', '2026-05-27 08:50:52.532755', '2026-05-27 08:50:52.532755');

INSERT INTO "public"."users" ("id", "name", "email", "password_hash", "role", "status", "created_at", "updated_at") VALUES
(1, 'Siti Rahayu', 'irvanadrian151@gmail.com', 'hash', 'CS / Sales', 'Aktif', '2026-05-27 08:50:52.373982', '2026-06-04 13:53:31.424321'),
(2, 'Rina Marlina', 'irvan@cnt.id', 'hash', 'CS / Sales', 'Aktif', '2026-05-27 08:50:52.373982', '2026-06-04 13:53:19.279919'),
(3, 'Chef Juna', 'chef@dyummy.com', 'hash', 'Kitchen', 'Aktif', '2026-05-27 08:50:52.373982', '2026-05-27 08:50:52.373982'),
(4, 'Andi Finance', 'finance@dyummy.com', 'hash', 'Finance', 'Aktif', '2026-05-27 08:50:52.373982', '2026-05-27 08:50:52.373982'),
(5, 'Bagas Purchasing', 'purchasing@dyummy.com', 'hash', 'Purchasing', 'Aktif', '2026-05-27 08:50:52.373982', '2026-05-27 08:50:52.373982'),
(6, 'Super Admin', 'admin@dyummy.com', 'hash', 'Super Admin', 'Aktif', '2026-05-27 08:50:52.373982', '2026-05-27 08:50:52.373982'),
(7, 'Subranto', 'absubranto@gmail.com', '12345678', 'Super Admin', 'Aktif', '2026-06-04 13:21:15.169437', '2026-06-04 13:21:15.169437'),
(8, 'Irvan', 'irvan.freelance@gmail.com', '12345678', 'Super Admin', 'Aktif', '2026-06-04 13:21:57.860278', '2026-06-04 13:21:57.860278');

INSERT INTO "public"."product_categories" ("id", "name", "created_at") VALUES
(1, 'Nasi Box', '2026-05-27 08:50:52.402846'),
(2, 'Snack Box', '2026-05-27 08:50:52.402846'),
(3, 'Prasmanan', '2026-05-27 08:50:52.402846'),
(4, 'Tumpeng', '2026-05-27 08:50:52.402846'),
(5, 'Coffee Break', '2026-05-27 08:50:52.402846');

INSERT INTO "public"."products" ("id", "name", "category_id", "description", "price", "status", "image_url", "created_at", "updated_at") VALUES
(1, 'Paket A', 3, '1. Nasi Putih
2. Menu Ayam (Ayam Suwir, Ayam Bakar, Ayam Asam Manis, Ayam Teriyaki)
3. Menu Telur (Rolade, Telur Balado, Telur Semur, Telur Bumbu Kuning, Telur Cabe Hejo)
4. Cah/Tumis (Capcay, Cah Jagung Semi Sosis, Sambal Goreng Kentang Ati, Bihun Sayur, Mie Goreng Bakso)
5. Sup/Soto (Sup bakso, Sup Sosis, Sup Ayam, Soto Bandung)
6. Kerupuk
7. Buah Potong
8. Air Mineral', 35000.00, 'Aktif', 'https://paq7eb6vqmyqlov3.public.blob.vercel-storage.com/prasmanan.png', '2026-05-27 08:50:52.454796', '2026-05-27 08:50:52.454796'),
(2, 'Paket B (40k)', 3, '1. Nasi Putih
2. Menu Ayam (Ayam Suwir, Ayam Bakar, Ayam Asam Manis, Ayam Teriyaki, Sate Ayam)
3. Menu Ikan/Telur (Ikan Kakap/Dori Asam Manis, Ikan kakap/Dori Saos Padang, Rolade, Telur Balado, Telur Semur, Telur Bumbu Kuning, Telur Cabe Hejo)
4. Cah/Tumis (Capcay, Cah Jagung Semi Sosis, Sambal Goreng Kentang Ati, Bihun Sayur, Mie Goreng Bakso)
5. Sup/Soto (Sup bakso, sup sosis, sup ayam, soto Bandung)
6. Kerupuk
7. Buah Potong
8. Air Mineral', 40000.00, 'Aktif', 'https://paq7eb6vqmyqlov3.public.blob.vercel-storage.com/prasmanan.png', '2026-05-27 08:50:52.454796', '2026-05-27 08:50:52.454796'),
(3, 'Paket B (45k)', 3, '1. Nasi Putih
2. Menu Daging (Gepuk, Sapi lada Hitam, Rendang, Sate Daging Sapi, Rolade Sapi, Semur Daging)
3. Menu Ayam/Ikan/Telur (Ayam Suwir, Ayam Bakar, Ayam Asam Manis, Ayam Teriyaki, Sate Ayam, Ikan Kakap/Dori Asam Manis, Ikan kakap/Dori Saos Padang, Rolade, Telur Balado, Telur Semur, Telur Bumbu Kuning, Telur Cabe Hejo)
4. Cah/ Tumis (Capcay, Cah Jagung Semi Sosis, Sambal Goreng Kentang Ati, Bihun Sayur, Mie Goreng Bakso)
5. Sup/ Soto (Sup bakso, sup sosis, sup ayam, soto Bandung)
6. Kerupuk
7. Buah Potong
8. Air Mineral', 45000.00, 'Aktif', 'https://paq7eb6vqmyqlov3.public.blob.vercel-storage.com/prasmanan.png', '2026-05-27 08:50:52.454796', '2026-05-27 08:50:52.454796'),
(4, 'Paket C', 3, '1. Nasi Putih
2. Menu Daging (Gepuk, Sapi lada Hitam, Rendang, Sate Daging Sapi, Rolade Sapi, Semur Daging)
3. Menu Ayam/Ikan (Ayam Suwir, Ayam Bakar, Ayam Asam Manis, Ayam Teriyaki, Sate Ayam, Ikan Kakap/Dori Asam Manis, Ikan kakap/Dori Saos Padang)
4. Menu Telur (Rolade, Telur Balado, Telur Semur, Telur Bumbu Kuning, Telur Cabe Hejo)
5. Cah/ Tumis (Capcay, cah jagung semi sosis, sambal goreng kentang-ati, bihun sayur, mie goreng)
6. Sup/ Soto (Sup Bakso, sup sosis, sup ayam, soto Bandung)
7. Kerupuk
8. Buah Potong
9. Air Mineral', 50000.00, 'Aktif', 'https://paq7eb6vqmyqlov3.public.blob.vercel-storage.com/prasmanan.png', '2026-05-27 08:50:52.454796', '2026-05-27 08:50:52.454796'),
(5, 'Paket Spesial Ayam', 1, '1. Nasi Putih
2. Menu Ayam (Ayam Bakar, Ayam Goreng, Ayam Serundeng, Ayam Bumbu Hejo, Ayam Bumbu Kecap, Ayam Balado)
3. Sayur/Tumis (Capcay, Sambal Goreng Kentang, Pecel Sayur, Orak Arik Buncis, Kimlo, Acar Wortel, Orek Tempe, Cah Tahu Buncis, Mie Goreng Bakso, Bihun Sayur)
4. Perkedel / Tahu / Tempe (Perkedel Jagung, Perkedel Kentang, Tahu Goreng, Tempe Goreng)
5. Lalapan
6. Sambal
7. Kerupuk
8. Air Mineral Cup', 30000.00, 'Aktif', 'https://paq7eb6vqmyqlov3.public.blob.vercel-storage.com/nasibox.png', '2026-05-27 08:50:52.454796', '2026-05-27 08:50:52.454796'),
(6, 'Paket Spesial Sapi', 1, '1. Nasi Putih
2. Daging Sapi (Rendang Sapi, Gepuk, Semur Sapi, Sapi Lada Hitam)
3. Sayur/Tumis (Capcay, Sambal Goreng Kentang, Pecel Sayur, Orak Arik Buncis, Kimlo, Acar Wortel, Orek Tempe, Cah Tahu Buncis, Mie Goreng Bakso, Bihun Sayur)
4. Perkedel / Tahu / Tempe (Perkedel Jagung, Perkedel Kentang, Tahu Goreng, Tempe Goreng)
5. Lalapan
6. Sambal
7. Kerupuk
8. Air Mineral Cup', 32000.00, 'Aktif', 'https://paq7eb6vqmyqlov3.public.blob.vercel-storage.com/nasibox.png', '2026-05-27 08:50:52.454796', '2026-05-27 08:50:52.454796'),
(7, 'Paket Istimewa', 1, '1. Nasi Putih
2. Daging Sapi/Ikan/Ayam (Rendang Sapi, Gepuk, Sapi Lada Hitam, Kakap Asam Manis, Kakap Saos Padang, Ayam Bakar, Ayam Goreng, Ayam Serundeng, Ayam Bumbu Hejo, Ayam Bumbu Kecap, Ayam Balado)
3. Telur (Telur Balado, Telur Semur, Telur Bumbu Kuning, Telur Bumbu Hejo)
4. Sayur/Tumis (Capcay, Sambal Goreng Kentang, Pecel Sayur, Orak Arik Buncis, Kimlo, Acar Wortel, Orek Tempe, Cah Tahu Buncis, Mie Goreng Bakso, Bihun Sayur)
5. Perkedel/Jugung/Kentang, Tahu/Tempe Goreng (Perkedel jagung, Perkedel Kentang, Tahu Goreng, Tempe Goreng, Tahu Bacem, Tempe Bacem)
6. Lalapan
7. Sambal
8. Kerupuk', 36000.00, 'Aktif', 'https://paq7eb6vqmyqlov3.public.blob.vercel-storage.com/nasibox.png', '2026-05-27 08:50:52.454796', '2026-05-27 08:50:52.454796'),
(8, 'Paket Hemat', 1, '1. Nasi Putih
2. Menu Ayam (Ayam Bakar, Ayam Goreng, Ayam Serundeng, Ayam Bumbu Hejo, Ayam Bumbu Kecap, Ayam Balado)
3. Sayur/Tumis (Kimlo, Orek Tempe, Cah Tahu Buncis, Mie Goreng Bakso, Bihun Sayur)
4. Lalapan
5. Sambal
6. Kerupuk', 22000.00, 'Aktif', 'https://paq7eb6vqmyqlov3.public.blob.vercel-storage.com/nasibox.png', '2026-05-27 08:50:52.454796', '2026-05-27 08:50:52.454796'),
(9, 'Paket Nikmat', 1, '1. Nasi Putih
2. Menu Ayam (Ayam Bakar, Ayam Goreng, Ayam Serundeng, Ayam Bumbu Hejo, Ayam Bumbu Kecap, Ayam Balado)
3. Sayur/Tumis (Kimlo, Orek Tempe, Cah Tahu Buncis, Mie Goreng Bakso, Bihun Sayur)
4. Tahu/Tempe (Tahu Goreng/Bacem, Tempe Goreng/Bacem)
5. Lalapan
6. Sambal
7. Kerupuk', 25000.00, 'Aktif', 'https://paq7eb6vqmyqlov3.public.blob.vercel-storage.com/nasibox.png', '2026-05-27 08:50:52.454796', '2026-05-27 08:50:52.454796'),
(10, 'Paket Lengkap', 1, '1. Nasi Putih
2. Menu Ayam (Ayam Bakar, Ayam Goreng, Ayam Serundeng, Ayam Bumbu Hejo, Ayam Bumbu Kecap, Ayam Balado)
3. Sayur/Tumis (Orak Arik Buncis, Kimlo, Acar Wortel, Orek Tempe, Cah Tahu Buncis, Mie Goreng Bakso, Bihun Sayur)
4. Perkedel/Tahu/Tempe (Perkedel Jagung, Perkedel Kentang, Tahu Goreng, Tempe Goreng)
5. Lalapan
6. Sambal
7. Kerupuk', 27000.00, 'Aktif', 'https://paq7eb6vqmyqlov3.public.blob.vercel-storage.com/nasibox.png', '2026-05-27 08:50:52.454796', '2026-05-27 08:50:52.454796');

INSERT INTO "public"."recipes" ("id", "product_id", "menu_name", "ingredients", "standard_cost", "created_at", "updated_at") VALUES
(1, 1, 'Ayam Bakar Kecap', 'Ayam potong, kecap, bumbu', 9000.00, '2026-05-27 08:50:52.480938', '2026-05-27 08:50:52.480938'),
(2, 1, 'Telur Balado', 'Telur, cabai, tomat', 3500.00, '2026-05-27 08:50:52.480938', '2026-05-27 08:50:52.480938'),
(3, 1, 'Tempe Orek', 'Tempe, cabai, kecap', 2500.00, '2026-05-27 08:50:52.480938', '2026-05-27 08:50:52.480938'),
(4, 2, 'Sapi Lada Hitam', 'Daging sapi, paprika, lada hitam', 22000.00, '2026-05-27 08:50:52.480938', '2026-05-27 08:50:52.480938'),
(5, 2, 'Ayam Geprek', 'Ayam fillet, sambal geprek', 11000.00, '2026-05-27 08:50:52.480938', '2026-05-27 08:50:52.480938'),
(6, 3, 'Tumis Udang Brokoli', 'Udang, brokoli, saus tiram', 14000.00, '2026-05-27 08:50:52.480938', '2026-05-27 08:50:52.480938'),
(7, 4, 'Gulai Kambing', 'Kambing, santan, rempah', 28000.00, '2026-05-27 08:50:52.480938', '2026-05-27 08:50:52.480938'),
(8, 4, 'Rendang Daging', 'Sapi, santan, bumbu rendang', 26000.00, '2026-05-27 08:50:52.480938', '2026-05-27 08:50:52.480938'),
(9, 5, 'Ikan Asam Pedas', 'Ikan tongkol, asam, cabai', 12000.00, '2026-05-27 08:50:52.480938', '2026-05-27 08:50:52.480938'),
(10, 6, 'Beef Wellington', 'Beef tenderloin, pastry, mushroom', 45000.00, '2026-05-27 08:50:52.480938', '2026-05-27 08:50:52.480938'),
(11, 7, 'Salmon Panggang', 'Salmon fillet, herbs, lemon', 42000.00, '2026-05-27 08:50:52.480938', '2026-05-27 08:50:52.480938'),
(12, 8, 'Risoles Ragout', 'Tepung, ragout ayam', 4500.00, '2026-05-27 08:50:52.480938', '2026-05-27 08:50:52.480938'),
(13, 9, 'Kroket Kentang', 'Kentang, daging cincang', 6000.00, '2026-05-27 08:50:52.480938', '2026-05-27 08:50:52.480938'),
(14, 10, 'Tumpeng Kuning', 'Nasi kuning, aneka lauk, urap', 18000.00, '2026-05-27 08:50:52.480938', '2026-05-27 08:50:52.480938');

INSERT INTO "public"."orders" ("id", "customer_id", "lead_id", "pic_id", "order_date", "delivery_date", "departure_time", "arrival_time", "venue", "order_notes", "status_order", "status_payment", "grand_total", "created_at", "updated_at") VALUES
(1, 1, 1, 1, '2026-04-28', '2026-05-05', '07:00:00', NULL, 'Gedung PT Maju Jakarta', NULL, 'Selesai', 'Lunas', 7100000.00, '2026-05-27 08:50:52.559854', '2026-05-27 08:50:52.559854'),
(2, 3, 3, 1, '2026-04-29', '2026-05-10', '08:00:00', NULL, 'Ballroom Savannah Bandung', NULL, 'Selesai', 'Lunas', 12750000.00, '2026-05-27 08:50:52.586594', '2026-05-27 08:50:52.586594'),
(3, 3, 5, 1, '2026-04-30', '2026-05-12', '09:00:00', NULL, 'Hotel Savoy Ballroom', NULL, 'Selesai', 'DP 50%', 17000000.00, '2026-05-27 08:50:52.609807', '2026-05-27 08:50:52.609807'),
(4, 6, 6, 1, '2026-05-03', '2026-05-17', '07:30:00', NULL, 'Grha Sanusi Unpad', NULL, 'Diproses', 'Belum Lunas', 14000000.00, '2026-05-27 08:50:52.633669', '2026-05-27 08:50:52.633669'),
(5, 8, 8, 1, '2026-05-05', '2026-05-12', '08:00:00', NULL, 'Balai RW 05 Cibeunying', NULL, 'Selesai', 'Lunas', 2520000.00, '2026-05-27 08:50:52.657725', '2026-05-27 08:50:52.657725'),
(6, 1, 11, 1, '2026-05-08', '2026-05-19', '07:00:00', NULL, 'Kantor Pusat PT Maju', NULL, 'Baru', 'DP 50%', 10100000.00, '2026-05-27 08:50:52.681752', '2026-05-27 08:50:52.681752'),
(7, 2, 14, 1, '2026-05-11', '2026-05-24', '08:00:00', NULL, 'Aula APTIKOM Bandung', NULL, 'Diproses', 'Belum Lunas', 5700000.00, '2026-05-27 08:50:52.708003', '2026-05-27 08:50:52.708003'),
(8, 4, 25, 1, '2026-05-22', '2026-05-28', '09:00:00', NULL, 'Yayasan Nurul Iman', NULL, 'Baru', 'Belum Lunas', 5600000.00, '2026-05-27 08:50:52.736254', '2026-05-27 08:50:52.736254'),
(9, 8, 28, 2, '2026-05-03', '2026-05-10', '08:00:00', NULL, 'Balai Warga', NULL, 'Selesai', 'Lunas', 840000.00, '2026-05-27 08:50:52.760544', '2026-05-27 08:50:52.760544'),
(10, 4, 33, 2, '2026-05-13', '2026-05-20', '08:30:00', NULL, 'Aula Yayasan', NULL, 'Selesai', 'Lunas', 2100000.00, '2026-05-27 08:50:52.784195', '2026-05-27 08:50:52.784195'),
(11, 6, 35, 2, '2026-05-17', '2026-05-25', '08:00:00', NULL, 'Aula Universitas', NULL, 'Baru', 'Belum Lunas', 1700000.00, '2026-05-27 08:50:52.80821', '2026-05-27 08:50:52.80821'),
(12, 9, NULL, 1, '2026-05-21', '2026-05-30', '10:00:00', NULL, 'Rumah Hendra Bandung', NULL, 'Baru', 'Belum Lunas', 3610000.00, '2026-05-27 08:50:52.834217', '2026-05-27 08:50:52.834217'),
(14, 12, NULL, NULL, '2026-05-27', '2026-06-05', '10:00:00', '11:00:00', 'Gedung Cyber Kuningan', 'Minta sendok plastik', 'Baru', 'Belum Lunas', 300000.00, '2026-05-27 09:44:40.863868', '2026-05-27 09:44:40.863868'),
(15, 12, NULL, NULL, '2026-05-27', '2026-06-05', '10:00:00', '11:00:00', 'Gedung Cyber Kuningan', 'Minta sendok plastik', 'Baru', 'Belum Lunas', 300000.00, '2026-05-27 09:44:46.702079', '2026-05-27 09:44:46.702079'),
(16, 12, NULL, 1, '2026-05-27', '2026-06-05', '10:00:00', '11:00:00', 'Gedung Cyber Kuningan', 'Minta sendok plastik', 'Baru', 'Belum Lunas', 300000.00, '2026-05-27 09:48:35.328596', '2026-05-27 09:48:35.328596');

INSERT INTO "public"."order_items" ("id", "order_id", "product_id", "custom_menu", "price", "quantity", "discount", "subtotal", "created_at") VALUES
(1, 1, 1, NULL, 28000.00, 200, 0.00, 5600000.00, '2026-05-27 08:50:52.861127'),
(2, 1, 3, NULL, 15000.00, 100, 0.00, 1500000.00, '2026-05-27 08:50:52.888024'),
(3, 2, 6, NULL, 85000.00, 150, 0.00, 12750000.00, '2026-05-27 08:50:52.936826'),
(4, 3, 6, NULL, 85000.00, 200, 0.00, 17000000.00, '2026-05-27 08:50:52.962124'),
(5, 4, 2, NULL, 35000.00, 400, 0.00, 14000000.00, '2026-05-27 08:50:52.986166'),
(6, 5, 1, NULL, 28000.00, 90, 0.00, 2520000.00, '2026-05-27 08:50:53.009387'),
(7, 6, 2, NULL, 35000.00, 200, 0.00, 7000000.00, '2026-05-27 08:50:53.035183'),
(8, 6, 4, NULL, 22000.00, 100, 0.00, 2200000.00, '2026-05-27 08:50:53.061101'),
(9, 6, 8, NULL, 18000.00, 50, 0.00, 900000.00, '2026-05-27 08:50:53.086145'),
(10, 7, 1, NULL, 28000.00, 150, 0.00, 4200000.00, '2026-05-27 08:50:53.109322'),
(11, 7, 3, NULL, 15000.00, 100, 0.00, 1500000.00, '2026-05-27 08:50:53.136169'),
(12, 8, 1, NULL, 28000.00, 200, 0.00, 5600000.00, '2026-05-27 08:50:53.161086'),
(13, 9, 1, NULL, 28000.00, 30, 0.00, 840000.00, '2026-05-27 08:50:53.187145'),
(14, 10, 5, NULL, 65000.00, 30, 0.00, 1950000.00, '2026-05-27 08:50:53.214024'),
(15, 10, 3, NULL, 15000.00, 10, 0.00, 150000.00, '2026-05-27 08:50:53.238502'),
(16, 11, 1, NULL, 28000.00, 50, 0.00, 1400000.00, '2026-05-27 08:50:53.261677'),
(17, 11, 3, NULL, 15000.00, 20, 0.00, 300000.00, '2026-05-27 08:50:53.284672'),
(18, 12, 5, NULL, 65000.00, 50, 0.00, 3250000.00, '2026-05-27 08:50:53.307898'),
(19, 12, 8, NULL, 18000.00, 20, 0.00, 360000.00, '2026-05-27 08:50:53.333708'),
(20, 14, 5, '1. NASI PUTIH
2. AYAM SERUNDENG', 30000.00, 10, 0.00, 300000.00, '2026-05-27 09:44:40.863868'),
(21, 15, 5, '1. NASI PUTIH
2. AYAM SERUNDENG', 30000.00, 10, 0.00, 300000.00, '2026-05-27 09:44:46.702079'),
(22, 16, 5, '1. NASI PUTIH
2. AYAM SERUNDENG', 30000.00, 10, 0.00, 300000.00, '2026-05-27 09:48:35.328596');

INSERT INTO "public"."production_schedules" ("id", "chef_id", "target_date", "total_revenue", "budget_limit", "total_estimated_hpp", "status", "created_at", "updated_at") VALUES
(1, 3, '2026-05-05', 9620000.00, 4810000.00, 4250000.00, 'Approved', '2026-05-27 08:50:53.394505', '2026-05-27 08:50:53.394505'),
(2, 3, '2026-05-12', 29750000.00, 14875000.00, 15200000.00, 'Overbudget Warning', '2026-05-27 08:50:53.394505', '2026-05-27 08:50:53.394505'),
(3, 3, '2026-05-19', 10100000.00, 5050000.00, 0.00, 'Draft', '2026-05-27 08:50:53.394505', '2026-05-27 08:50:53.394505');

INSERT INTO "public"."schedule_orders" ("schedule_id", "order_id") VALUES
(1, 1),
(1, 5),
(2, 2),
(2, 3),
(3, 6),
(3, 7);

INSERT INTO "public"."schedule_menus" ("id", "schedule_id", "recipe_id", "quantity_pax", "hpp_subtotal", "created_at") VALUES
(5, 1, 1, 200, 1800000.00, '2026-05-27 08:50:53.44721'),
(6, 1, 2, 200, 700000.00, '2026-05-27 08:50:53.44721'),
(7, 1, 3, 200, 500000.00, '2026-05-27 08:50:53.44721'),
(8, 1, 1, 90, 810000.00, '2026-05-27 08:50:53.44721'),
(9, 1, 2, 90, 315000.00, '2026-05-27 08:50:53.44721'),
(10, 1, 3, 90, 125000.00, '2026-05-27 08:50:53.44721'),
(11, 2, 10, 150, 6750000.00, '2026-05-27 08:50:53.44721'),
(12, 2, 11, 150, 6300000.00, '2026-05-27 08:50:53.44721'),
(13, 2, 7, 200, 5600000.00, '2026-05-27 08:50:53.44721'),
(14, 2, 8, 200, 5200000.00, '2026-05-27 08:50:53.44721');

INSERT INTO "public"."purchase_requests" ("id", "schedule_id", "chef_id", "total_pr_value", "status", "created_at") VALUES
(1, 1, 3, 4250000.00, 'Sent to Purchasing', '2026-05-27 08:50:53.472219'),
(2, 2, 3, 15200000.00, 'Sent to Purchasing', '2026-05-27 08:50:53.472219');

INSERT INTO "public"."pr_items" ("id", "pr_id", "item_name", "quantity", "uom", "estimated_price", "subtotal", "created_at") VALUES
(4, 1, 'Ayam Potong', 30.00, 'Ekor', 40000.00, 1200000.00, '2026-05-27 08:50:53.498149'),
(5, 1, 'Telur Ayam', 10.00, 'Kg', 28000.00, 280000.00, '2026-05-27 08:50:53.498149'),
(6, 1, 'Tempe', 15.00, 'Kg', 15000.00, 225000.00, '2026-05-27 08:50:53.498149'),
(7, 1, 'Kemasan Box', 300.00, 'Pcs', 3500.00, 1050000.00, '2026-05-27 08:50:53.498149'),
(8, 1, 'Bumbu Jadi', 1.00, 'Paket', 500000.00, 500000.00, '2026-05-27 08:50:53.498149'),
(9, 2, 'Beef Tenderloin', 30.00, 'Kg', 200000.00, 6000000.00, '2026-05-27 08:50:53.498149'),
(10, 2, 'Salmon Fillet', 30.00, 'Kg', 180000.00, 5400000.00, '2026-05-27 08:50:53.498149'),
(11, 2, 'Daging Sapi Rendang', 35.00, 'Kg', 130000.00, 4550000.00, '2026-05-27 08:50:53.498149'),
(12, 2, 'Bahan Pelengkap', 1.00, 'Paket', 1250000.00, 1250000.00, '2026-05-27 08:50:53.498149');

INSERT INTO "public"."purchase_orders" ("id", "pr_id", "purchasing_id", "finance_id", "po_date", "total_actual_cost", "status_po", "status_cost", "variance_notes", "created_at", "updated_at") VALUES
(1, 1, 5, 4, '2026-05-04', 4100000.00, 'Selesai Belanja', 'Safe', 'Sesuai estimasi, hemat 150rb', '2026-05-27 08:50:53.523139', '2026-05-27 08:50:53.523139'),
(2, 2, 5, 4, '2026-05-11', 18500000.00, 'Selesai Belanja', 'Overbudget', 'Daging impor naik 15% krn kurs dolar. Salmon langka +20rb/kg. Variance Rp3.3 juta', '2026-05-27 08:50:53.523139', '2026-05-27 08:50:53.523139');

INSERT INTO "public"."overheads" ("id", "finance_id", "expense_date", "category", "amount", "notes", "created_at") VALUES
(1, 4, '2026-05-05', 'Kemasan', 350000.00, 'Box premium + mika', '2026-05-27 08:50:53.550041'),
(2, 4, '2026-05-05', 'Transportasi', 150000.00, 'Bensin 2 motor antar', '2026-05-27 08:50:53.550041'),
(3, 4, '2026-05-05', 'Gas', 200000.00, 'Isi 2 tabung 12kg', '2026-05-27 08:50:53.550041'),
(4, 4, '2026-05-05', 'Uang Makan', 120000.00, '5 kru dapur', '2026-05-27 08:50:53.550041'),
(5, 4, '2026-05-12', 'Kemasan', 520000.00, 'Box VIP + tissue', '2026-05-27 08:50:53.550041'),
(6, 4, '2026-05-12', 'Transportasi', 250000.00, 'Sewa pickup ke Jakarta', '2026-05-27 08:50:53.550041'),
(7, 4, '2026-05-12', 'Gas', 200000.00, 'Isi tabung gas', '2026-05-27 08:50:53.550041'),
(8, 4, '2026-05-12', 'Uang Makan', 150000.00, '6 kru + lembur', '2026-05-27 08:50:53.550041'),
(9, 4, '2026-05-17', 'Kemasan', 280000.00, 'Box reguler bulk', '2026-05-27 08:50:53.550041'),
(10, 4, '2026-05-17', 'Transportasi', 120000.00, 'Bensin operasional', '2026-05-27 08:50:53.550041'),
(11, 4, '2026-05-17', 'Listrik', 180000.00, 'Tagihan listrik dapur', '2026-05-27 08:50:53.550041'),
(12, 4, '2026-05-19', 'Gas', 200000.00, 'Tabung gas mingguan', '2026-05-27 08:50:53.550041'),
(13, 4, '2026-05-19', 'Transportasi', 180000.00, 'Antar + belanja bahan', '2026-05-27 08:50:53.550041'),
(14, 4, '2026-05-24', 'Uang Makan', 130000.00, '4 kru pagi', '2026-05-27 08:50:53.550041');



-- Indices
CREATE UNIQUE INDEX customers_phone_key ON public.customers USING btree (phone);
ALTER TABLE "public"."leads" ADD FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE CASCADE;
ALTER TABLE "public"."leads" ADD FOREIGN KEY ("pic_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;


-- Indices
CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);


-- Indices
CREATE UNIQUE INDEX product_categories_name_key ON public.product_categories USING btree (name);
ALTER TABLE "public"."products" ADD FOREIGN KEY ("category_id") REFERENCES "public"."product_categories"("id") ON DELETE SET NULL;
ALTER TABLE "public"."recipes" ADD FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;
ALTER TABLE "public"."orders" ADD FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE SET NULL;
ALTER TABLE "public"."orders" ADD FOREIGN KEY ("pic_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;
ALTER TABLE "public"."orders" ADD FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE RESTRICT;
ALTER TABLE "public"."order_items" ADD FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;
ALTER TABLE "public"."order_items" ADD FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE RESTRICT;
ALTER TABLE "public"."production_schedules" ADD FOREIGN KEY ("chef_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;
ALTER TABLE "public"."schedule_orders" ADD FOREIGN KEY ("schedule_id") REFERENCES "public"."production_schedules"("id") ON DELETE CASCADE;
ALTER TABLE "public"."schedule_orders" ADD FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;
ALTER TABLE "public"."schedule_menus" ADD FOREIGN KEY ("schedule_id") REFERENCES "public"."production_schedules"("id") ON DELETE CASCADE;
ALTER TABLE "public"."schedule_menus" ADD FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE RESTRICT;
ALTER TABLE "public"."purchase_requests" ADD FOREIGN KEY ("schedule_id") REFERENCES "public"."production_schedules"("id") ON DELETE CASCADE;
ALTER TABLE "public"."purchase_requests" ADD FOREIGN KEY ("chef_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;


-- Indices
CREATE UNIQUE INDEX purchase_requests_schedule_id_key ON public.purchase_requests USING btree (schedule_id);
ALTER TABLE "public"."pr_items" ADD FOREIGN KEY ("pr_id") REFERENCES "public"."purchase_requests"("id") ON DELETE CASCADE;
ALTER TABLE "public"."purchase_orders" ADD FOREIGN KEY ("finance_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;
ALTER TABLE "public"."purchase_orders" ADD FOREIGN KEY ("purchasing_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;
ALTER TABLE "public"."purchase_orders" ADD FOREIGN KEY ("pr_id") REFERENCES "public"."purchase_requests"("id") ON DELETE CASCADE;


-- Indices
CREATE UNIQUE INDEX purchase_orders_pr_id_key ON public.purchase_orders USING btree (pr_id);
ALTER TABLE "public"."overheads" ADD FOREIGN KEY ("finance_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;
