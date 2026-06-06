const XLSX = require("xlsx");

const headers = [
  "Nama Customer", "No. Telepon", "Tipe Customer", "Nama CS / PIC", "Tanggal Order", "Tanggal Kirim",
  "Jam Keberangkatan", "Jam Tiba", "Venue / Lokasi", "Catatan Order", "Status Order",
  "Status Pembayaran", "Grand Total",
  
  "Item 1: Produk", "Item 1: Kuantitas", "Item 1: Harga Satuan", "Item 1: Catatan", "Item 1: Lauk Custom",
  "Item 2: Produk", "Item 2: Kuantitas", "Item 2: Harga Satuan", "Item 2: Catatan", "Item 2: Lauk Custom"
];

const data = [
  [
    "Kurniawan Perkasa", "081299998888", "Personal", "Siti Rahayu", "2026-05-27", "2026-06-05",
    "10:00:00", "11:00:00", "Gedung Cyber Kuningan", "Minta sendok plastik", "Baru",
    "Belum Lunas", "300000",
    "Paket Spesial Ayam", "10", "30000", "Pedas saja", "1. NASI PUTIH\n2. AYAM SERUNDENG",
    "", "", "", "", ""
  ],
  [
    "Ahmad Yani", "08123456789", "Corporate", "Rina Marlina", "2026-05-27", "2026-06-08",
    "11:00:00", "12:00:00", "Kantor BNI Sudirman", "Rapat Divisi IT", "Diproses",
    "DP 50%", "2100000",
    "Paket Spesial Sapi", "20", "32000", "Sendok & garpu lengkap", "1. NASI GORENG\n2. DAGING LADA HITAM",
    "Paket Spesial Ayam", "20", "30000", "Minta dipisah sambal", "1. NASI PUTIH\n2. AYAM BAKAR"
  ]
];

const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Orders");
XLSX.writeFile(wb, "test_orders.xlsx");
console.log("test_orders.xlsx created successfully!");
