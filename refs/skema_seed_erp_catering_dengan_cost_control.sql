-- ==============================================================================
-- DATABASE SCHEMA: CATERING ERP & CRM + COST CONTROL (NEON POSTGRESQL)
-- Revisi: Penambahan "Jadwal Menu Produksi" sebagai Pre-Warning Gate
-- ==============================================================================

-- 1. DROP TABLES (Urutan harus benar dari anak ke induk)
DROP TABLE IF EXISTS overheads CASCADE;
DROP TABLE IF EXISTS purchase_orders CASCADE;
DROP TABLE IF EXISTS pr_items CASCADE;
DROP TABLE IF EXISTS purchase_requests CASCADE;
DROP TABLE IF EXISTS schedule_menus CASCADE;
DROP TABLE IF EXISTS schedule_orders CASCADE;
DROP TABLE IF EXISTS production_schedules CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS leads CASCADE;
DROP TABLE IF EXISTS recipes CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS product_categories CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ==============================================================================
-- A. STRUKTUR EKSISTING (CRM, Master Data & Orders)
-- ==============================================================================

CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(50) NOT NULL, 
    status VARCHAR(50) DEFAULT 'Aktif', 
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE customers (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) UNIQUE,
    email VARCHAR(255),
    type VARCHAR(100),
    address TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE leads (
    id BIGSERIAL PRIMARY KEY,
    customer_id BIGINT REFERENCES customers(id) ON DELETE CASCADE,
    pic_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    lead_date DATE NOT NULL,
    source VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL,
    tags VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE product_categories (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE products (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category_id BIGINT REFERENCES product_categories(id) ON DELETE SET NULL,
    description TEXT,
    price DECIMAL(15, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'Aktif',
    image_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- MASTER RESEP: Sekarang berfungsi sebagai Master Menu (HPP per porsi)
CREATE TABLE recipes (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT REFERENCES products(id) ON DELETE CASCADE,
    menu_name VARCHAR(255) NOT NULL, -- Contoh: "Sapi Lada Hitam", "Ayam Bakar"
    ingredients TEXT NOT NULL,
    standard_cost DECIMAL(15, 2) NOT NULL, -- HPP standar per porsi
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE orders (
    id BIGSERIAL PRIMARY KEY,
    customer_id BIGINT REFERENCES customers(id) ON DELETE RESTRICT,
    lead_id BIGINT REFERENCES leads(id) ON DELETE SET NULL,
    pic_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    order_date DATE NOT NULL,
    delivery_date DATE NOT NULL,
    departure_time TIME,
    arrival_time TIME,
    venue TEXT,
    order_notes TEXT,
    status_order VARCHAR(50) DEFAULT 'Baru',
    status_payment VARCHAR(50) DEFAULT 'Belum Lunas',
    grand_total DECIMAL(15, 2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE order_items (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT REFERENCES orders(id) ON DELETE CASCADE,
    product_id BIGINT REFERENCES products(id) ON DELETE RESTRICT,
    custom_menu TEXT,
    price DECIMAL(15, 2) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    discount DECIMAL(15, 2) DEFAULT 0,
    subtotal DECIMAL(15, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- ==============================================================================
-- B. MODUL COST CONTROL & PERENCANAAN PRODUKSI (BARU)
-- Menjawab attachment "Jadwal Menu" dan Pre-Warning HPP
-- ==============================================================================

-- 1. PRODUCTION SCHEDULES (Jadwal Menu Harian oleh Chef)
-- Di sinilah batas anggaran ditetapkan sebelum Chef menyusun menu masakan.
CREATE TABLE production_schedules (
    id BIGSERIAL PRIMARY KEY,
    chef_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    target_date DATE NOT NULL, -- Tanggal produksi / pengiriman
    total_revenue DECIMAL(15, 2) DEFAULT 0, -- Omset dari order yang ditarik
    budget_limit DECIMAL(15, 2) DEFAULT 0, -- Batas BPP (misal: max 60% dari revenue)
    total_estimated_hpp DECIMAL(15, 2) DEFAULT 0, -- HPP kalkulasi dari pilihan menu Chef
    status VARCHAR(50) DEFAULT 'Draft', -- 'Draft', 'Overbudget Warning', 'Approved'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. SCHEDULE ORDERS (Agregasi Order)
-- Menautkan order mana saja yang dikerjakan pada Jadwal Menu ini.
CREATE TABLE schedule_orders (
    schedule_id BIGINT REFERENCES production_schedules(id) ON DELETE CASCADE,
    order_id BIGINT REFERENCES orders(id) ON DELETE CASCADE,
    PRIMARY KEY (schedule_id, order_id)
);

-- 3. SCHEDULE MENUS (Pemilihan Menu)
-- Saat Chef membuat "Jadwal Menu", Chef memasukkan pilihan lauk/resep. Sistem menghitung HPP otomatis.
CREATE TABLE schedule_menus (
    id BIGSERIAL PRIMARY KEY,
    schedule_id BIGINT REFERENCES production_schedules(id) ON DELETE CASCADE,
    recipe_id BIGINT REFERENCES recipes(id) ON DELETE RESTRICT,
    quantity_pax INT NOT NULL, -- Jumlah porsi yang dimasak
    hpp_subtotal DECIMAL(15, 2) NOT NULL, -- Kuantitas x Standard Cost (Otomatis)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. PURCHASE REQUESTS (Daftar Belanja Bahan Mentah)
-- Hanya bisa dibuat jika Production Schedule sudah berstatus 'Approved' (Tidak overbudget)
CREATE TABLE purchase_requests (
    id BIGSERIAL PRIMARY KEY,
    schedule_id BIGINT UNIQUE REFERENCES production_schedules(id) ON DELETE CASCADE,
    chef_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    total_pr_value DECIMAL(15, 2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'Draft', -- 'Draft', 'Sent to Purchasing'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE pr_items (
    id BIGSERIAL PRIMARY KEY,
    pr_id BIGINT REFERENCES purchase_requests(id) ON DELETE CASCADE,
    item_name VARCHAR(255) NOT NULL, -- Contoh: "Daging Sapi", "Cabai"
    quantity DECIMAL(10, 2) NOT NULL,
    uom VARCHAR(50) NOT NULL,
    estimated_price DECIMAL(15, 2) NOT NULL, 
    subtotal DECIMAL(15, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. PURCHASE ORDERS (Eksekusi Purchasing & Realisasi Finance)
-- Tempat Finance menginput Actual Cost sesuai Nota Belanja Asli.
CREATE TABLE purchase_orders (
    id BIGSERIAL PRIMARY KEY,
    pr_id BIGINT UNIQUE REFERENCES purchase_requests(id) ON DELETE CASCADE,
    purchasing_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    finance_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    po_date DATE NOT NULL,
    total_actual_cost DECIMAL(15, 2) DEFAULT 0, -- Diisi oleh Keuangan
    status_po VARCHAR(50) DEFAULT 'Diproses', -- 'Diproses', 'Selesai Belanja'
    status_cost VARCHAR(50) DEFAULT 'Pending', -- 'Safe', 'Overbudget' (Variance Keuangan)
    variance_notes TEXT, -- Catatan jika harga pasar mendadak naik (Actual > Est. HPP)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. OVERHEADS (Biaya Operasional Harian / Laporan P&L)
CREATE TABLE overheads (
    id BIGSERIAL PRIMARY KEY,
    finance_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    expense_date DATE NOT NULL,
    category VARCHAR(100) NOT NULL, -- 'Gas', 'Listrik', 'Transportasi', 'Kemasan'
    amount DECIMAL(15, 2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- C. DATA SEEDING TERINTEGRASI (Menghubungkan CRM ke Cost Control)
-- ==============================================================================

-- 1. Insert Users
INSERT INTO users (id, name, email, role, status) VALUES
(1, 'Siti (CS 1)', 'siti@catering.com', 'CS / Sales', 'Aktif'),
(2, 'Andi Finance', 'finance@catering.com', 'Finance', 'Aktif'),
(3, 'Super Admin', 'admin@catering.com', 'Super Admin', 'Aktif'),
(4, 'Chef Juna', 'chef@catering.com', 'Kitchen', 'Aktif'),
(5, 'Bagas Purchasing', 'purchasing@catering.com', 'Purchasing', 'Aktif');
SELECT setval('users_id_seq', 5);

-- 1.5 Insert Product Categories
INSERT INTO product_categories (id, name) VALUES
(1, 'Nasi Box'),
(2, 'Snack Box'),
(3, 'Prasmanan'),
(4, 'Tumpeng'),
(5, 'Coffee Break');
SELECT setval('product_categories_id_seq', 5);

-- 2. Insert Products (Katalog Jualan)
INSERT INTO products (id, name, category_id, price, status) VALUES
(1, 'Nasi Box Premium', 1, 30000.00, 'Aktif'),
(2, 'Prasmanan VIP', 3, 75000.00, 'Aktif');
SELECT setval('products_id_seq', 2);

-- 3. Insert Master Resep / Menu (Pilihan Lauk & HPP per porsi)
INSERT INTO recipes (id, product_id, menu_name, ingredients, standard_cost) VALUES
(1, 1, 'Ayam Bakar Madu', 'Ayam Potong, Bumbu Madu, Kecap', 12000.00),
(2, 1, 'Telur Balado', 'Telur Ayam, Cabai, Tomat', 4000.00),
(3, 2, 'Sapi Lada Hitam (VIP)', 'Daging Sapi Pilihan, Paprika, Lada Hitam', 25000.00),
(4, 2, 'Soup Kimlo (VIP)', 'Ayam, Jamur, Soun, Wortel', 8000.00);
SELECT setval('recipes_id_seq', 4);

-- 4. Insert Customers & Orders (CRM)
INSERT INTO customers (id, name, phone, type) VALUES
(1, 'Ressa', '085220073373', 'Instansi'),
(2, 'APTIKOM', '081233445566', 'Corporate');
SELECT setval('customers_id_seq', 2);

INSERT INTO orders (id, customer_id, pic_id, order_date, delivery_date, status_order, grand_total) VALUES
(1, 1, 1, '2026-05-18', '2026-05-19', 'Baru', 1500000.00), -- 50 Box (Revenue 1.5 Jt)
(2, 2, 1, '2026-05-18', '2026-05-19', 'Repeat', 7500000.00); -- 100 Pax Prasmanan (Revenue 7.5 Jt)
SELECT setval('orders_id_seq', 2);

INSERT INTO order_items (id, order_id, product_id, price, quantity, subtotal) VALUES
(1, 1, 1, 30000.00, 50, 1500000.00),
(2, 2, 2, 75000.00, 100, 7500000.00);
SELECT setval('order_items_id_seq', 2);

-- ==============================================================================
-- D. SIMULASI JADWAL MENU (MENJAWAB ATTACHMENT) & PRE-WARNING
-- ==============================================================================

-- STEP 1: Chef membuat "Jadwal Menu Produksi" untuk tanggal 19 Mei.
-- Agregasi Revenue: Order 1 + Order 2 = Rp 9.000.000.
-- Sistem mengunci Budget Limit BPP maksimal 50% = Rp 4.500.000.
INSERT INTO production_schedules (id, chef_id, target_date, total_revenue, budget_limit, total_estimated_hpp, status) VALUES
(1, 4, '2026-05-19', 9000000.00, 4500000.00, 0, 'Draft'); 
SELECT setval('production_schedules_id_seq', 1);

-- Map Order mana saja yang ditarik ke jadwal ini
INSERT INTO schedule_orders (schedule_id, order_id) VALUES (1, 1), (1, 2);

-- STEP 2: Chef memilih menu masakan untuk order-order tersebut (The "Jadwal Menu")
-- Box (50 pax): Ayam Bakar (12k) + Telur (4k) = 16k/pax -> 50 * 16k = 800.000
-- Prasmanan (100 pax): Sapi (25k) + Soup (8k) = 33k/pax -> 100 * 33k = 3.300.000
INSERT INTO schedule_menus (schedule_id, recipe_id, quantity_pax, hpp_subtotal) VALUES
(1, 1, 50, 600000.00), -- Ayam Bakar
(1, 2, 50, 200000.00), -- Telur Balado
(1, 3, 100, 2500000.00), -- Sapi Lada Hitam
(1, 4, 100, 800000.00);  -- Soup Kimlo

-- Total Estimated HPP Chef = 800k + 3.3M = 4.100.000
-- Sistem Check: 4.100.000 < 4.500.000 (Budget Limit). Maka Status otomatis jadi 'Approved'.
UPDATE production_schedules SET total_estimated_hpp = 4100000.00, status = 'Approved' WHERE id = 1;

-- STEP 3: Chef Generate Purchase Request (PR) dari Menu Schedule tsb
INSERT INTO purchase_requests (id, schedule_id, chef_id, total_pr_value, status) VALUES
(1, 1, 4, 4100000.00, 'Sent to Purchasing');
SELECT setval('purchase_requests_id_seq', 1);

-- List Bahan Mentah di PR
INSERT INTO pr_items (pr_id, item_name, quantity, uom, estimated_price, subtotal) VALUES
(1, 'Daging Sapi', 20, 'Kg', 125000.00, 2500000.00),
(1, 'Ayam Potong', 15, 'Ekor', 40000.00, 600000.00),
(1, 'Bahan Lainnya', 1, 'Paket', 1000000.00, 1000000.00);

-- STEP 4: Realisasi Keuangan (Finance input Actual Cost)
-- Ternyata harga Sapi naik parah. Uang keluar Rp 4.600.000.
-- Status PO berubah menjadi 'Overbudget' karena Actual (4.6M) > Est. HPP (4.1M).
INSERT INTO purchase_orders (id, pr_id, purchasing_id, finance_id, po_date, total_actual_cost, status_po, status_cost, variance_notes) VALUES
(1, 1, 5, 2, '2026-05-18', 4600000.00, 'Selesai Belanja', 'Overbudget', 'Harga Sapi potong mendadak langka di pasar, naik 20rb/kg');
SELECT setval('purchase_orders_id_seq', 1);

-- STEP 5: Finance Input Overhead (Untuk Laporan P&L)
INSERT INTO overheads (finance_id, expense_date, category, amount, notes) VALUES
(2, '2026-05-19', 'Kemasan', 200000.00, 'Beli Box & Mika VIP'),
(2, '2026-05-19', 'Transportasi', 100000.00, 'Bensin operasional kiriman');