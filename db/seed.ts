import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './schema';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const sql = neon(process.env.POSTGRES_URL!);
const db = drizzle(sql, { schema });

async function seed() {
  console.log('Seeding data...');

  try {
    // 1. Insert Users
    await db.insert(schema.users).values([
      { name: 'Siti (CS 1)', email: 'siti@catering.com', role: 'CS / Sales', status: 'Aktif' },
      { name: 'Budi (CS 2)', email: 'budi@catering.com', role: 'CS / Sales', status: 'Aktif' },
      { name: 'Andi Finance', email: 'finance@catering.com', role: 'Finance', status: 'Aktif' },
      { name: 'Super Admin', email: 'admin@catering.com', role: 'Super Admin', status: 'Aktif' },
    ]);
    console.log('Users seeded');

    // 2. Insert Products
    await db.insert(schema.products).values([
      { name: 'Nasi Box Paket Lengkap', category: 'Nasi Box', description: 'Paket nasi box komplit dengan buah dan air mineral', price: '27000.00', status: 'Aktif' },
      { name: 'Snack Box Premium', category: 'Snack Box', description: 'Snack box manis dan asin cocok untuk rapat atau acara santai', price: '15000.00', status: 'Aktif' },
      { name: 'Prasmanan VIP', category: 'Prasmanan', description: 'Paket prasmanan eksklusif dengan dekorasi meja dan pramusaji', price: '75000.00', status: 'Aktif' },
    ]);
    console.log('Products seeded');

    // 3. Insert Recipes
    await db.insert(schema.recipes).values([
      { product_id: 1, ingredients: 'Nasi Putih, Ayam Serundeng, Cah Tahu Buncis, Perkedel Jagung, Lalapan, Sambal, Kerupuk, Pisang, Box', standard_cost: '18000.00' },
      { product_id: 2, ingredients: 'Lontong Isi Ayam, Risoles Rogut, Brownies, Air Mineral Cup, Box', standard_cost: '8000.00' },
      { product_id: 3, ingredients: 'Nasi Putih, Nasi Goreng, Daging Sapi Lada Hitam, Ayam Kodok, Salad, Sop Kimlo, Puding', standard_cost: '40000.00' },
    ]);
    console.log('Recipes seeded');

    // 4. Insert Customers
    await db.insert(schema.customers).values([
      { name: 'Ressa', phone: '085220073373', type: 'Instansi', notes: 'Klien prioritas instansi' },
      { name: 'APTIKOM', phone: '081233445566', type: 'Corporate', notes: 'Sering pesan prasmanan untuk rapat' },
      { name: 'TINY HERNAWATI', phone: '081254314639', type: 'Personal', notes: 'Sering pesan bento' },
      { name: 'Anonim_19Mei_085711223344', phone: '085711223344', type: 'Personal', notes: 'Belum menyebutkan nama saat WA' },
    ]);
    console.log('Customers seeded');

    // 5. Insert Leads
    await db.insert(schema.leads).values([
      { customer_id: 1, pic_id: 1, lead_date: '2026-05-18', source: 'WhatsApp', status: 'Closed Won', tags: 'Instansi, Prioritas', notes: 'Langsung deal untuk acara kelurahan' },
      { customer_id: 2, pic_id: 1, lead_date: '2026-05-18', source: 'WhatsApp', status: 'Closed Won', tags: 'Kampus, Rapat', notes: 'Repeat order untuk APTIKOM' },
      { customer_id: 4, pic_id: 2, lead_date: '2026-05-19', source: 'Instagram', status: 'New Lead', tags: 'Tanya Harga', notes: 'Nanya paket nasi box buat ultah anak, belum konfirm' },
      { customer_id: 3, pic_id: 1, lead_date: '2026-05-19', source: 'WhatsApp', status: 'Follow Up', tags: 'Bento', notes: 'Minta dikirimin pricelist bento terbaru' },
    ]);
    console.log('Leads seeded');

    // 6. Insert Orders
    await db.insert(schema.orders).values([
      { customer_id: 1, lead_id: 1, pic_id: 1, order_date: '2026-05-18', delivery_date: '2026-05-19', departure_time: '10:00:00', arrival_time: '11:00:00', venue: 'Kantor Kelurahan Cisaranten Kidul, Jl. Riung Purna XI No.151, Kota Bandung', status_order: 'Repeat', status_payment: 'Lunas', grand_total: '1620000.00', estimated_budget: '1080000.00', actual_cost: '1100000.00', status_cost: 'Safe' },
      { customer_id: 2, lead_id: 2, pic_id: 1, order_date: '2026-05-18', delivery_date: '2026-05-19', departure_time: '08:00:00', arrival_time: '09:00:00', venue: 'Gedung APTIKOM Pusat', status_order: 'Repeat', status_payment: 'DP', grand_total: '3825000.00', estimated_budget: '2040000.00', actual_cost: '2500000.00', status_cost: 'Overbudget' },
    ]);
    console.log('Orders seeded');

    // 7. Insert Order Items
    await db.insert(schema.order_items).values([
      { order_id: 1, product_id: 1, custom_menu: '1. Nasi Putih\n2. Ayam Serundeng (pot. 8)\n3. Cah Tahu Buncis\n4. Perkedel Jagung', price: '27000.00', quantity: 60, discount: '0', subtotal: '1620000.00' },
      { order_id: 2, product_id: 3, custom_menu: 'Sesuai standar menu VIP APTIKOM', price: '75000.00', quantity: 51, discount: '0', subtotal: '3825000.00' },
    ]);
    console.log('Order Items seeded');

    console.log('Seeding completed successfully.');
  } catch (error) {
    console.error('Error during seeding:', error);
  }
}

seed();
