# PRD — D'Yummy Siap Saji
**Product Requirements Document v4.0**  
Agustus 2026 — Revisi final dari v3.0

> **Perubahan utama v4.0:** Ongkir dinamis per area × channel via tabel `area_channel_shipping` + function `get_shipping_fee()` dengan hierarki 3 level. Tidak ada perubahan pada `orders`, `order_items`, atau views operasional — hanya logika kalkulasi fee yang berubah.

---

## Daftar Isi

1. [Konteks & Data Operasional Nyata](#1-konteks--data-operasional-nyata)
2. [Infrastruktur & Free Tier](#2-infrastruktur--free-tier)
3. [Pengguna & Role](#3-pengguna--role)
4. [Arsitektur Data v4](#4-arsitektur-data-v4)
5. [Sistem Ongkir Dinamis (v4)](#5-sistem-ongkir-dinamis-v4)
6. [Modul Penjualan](#6-modul-penjualan)
7. [Modul Master Data](#7-modul-master-data)
8. [Modul Keuangan](#8-modul-keuangan)
9. [Modul Analitik — RFM](#9-modul-analitik--rfm)
10. [Dashboard](#10-dashboard)
11. [Dokumen Operasional Harian](#11-dokumen-operasional-harian)
12. [Kebutuhan Non-Fungsional](#12-kebutuhan-non-fungsional)
13. [Roadmap](#13-roadmap)
14. [Panduan Developer](#14-panduan-developer)

---

## 1. Konteks & Data Operasional Nyata

### 1.1 Dua Lini Bisnis, Satu Database

| Lini | Model | Status |
|------|-------|--------|
| **Catering** | Pesanan institusi/korporat, proses PR→PO | ERP eksisting (live) |
| **Siap Saji** | Penjualan harian retail, transaksi langsung final | **Modul ini** |

Pemisahan via kolom `lini` — tidak ada schema atau tabel terpisah.

### 1.2 Fakta dari Dokumen Operasional Nyata

| Temuan | Implementasi |
|--------|-------------|
| Brand di struk: **"DYummy Catering"** | `settings.brand_name_struk` — dikonfigurasi Owner |
| CS di struk: **Wanti Nova** | User pertama `CS_SS` |
| Format struk: `SI.2026.06.00266` | Counter bulanan di `settings`, seed mulai dari 266 |
| **2 rekening**: BCA 2832835545 & Mandiri 1310017802705 | `orders.payment_bank` + `orders.payment_account` |
| **Ongkir 2 tarif**: 12k (kota) & 14k (Cimahi/Kab.) | `shipping_zones` sebagai default fallback |
| **Jangkauan**: Kota Cimahi & Kab. Bandung | `areas` cover 32 kecamatan dari 3 wilayah |
| **Patokan/landmark** di hampir semua struk | `customers.patokan` — terpisah dari `address` |
| **Porsi ½** = SKU & harga berbeda, bukan pengali qty | `is_half_portion`, `parent_sku` di `products` |
| **Rekap tabel manual** CS dengan kolom Rekening | View `v_rekap_harian_ss` |
| **Ongkir per channel berbeda**: Marketplace gratis, Ahsan flat 15k, Gojek per zona | `area_channel_shipping` (v4) |

### 1.3 Produk Nyata (dari 23 struk 18 Jun 2026)

**Porsi Penuh:**

| SKU | Produk | Harga |
|-----|--------|-------|
| SP-A01 | Ayam Goreng Terasi Jeruk | Rp100.000 |
| SP-D01 | Beef Yakiniku | Rp100.000 |
| SP-I01 | Udang Bakar Saus Jimbaran | Rp100.000 |
| SP-I02 | Bandeng Isi | Rp65.000 |
| SP-T01 | Telur Ceplok Saus Tiram | Rp50.000 |
| SP-T02 | Semur Jengkol | Rp50.000 |
| SP-S01 | Terong Balado | Rp35.000 |
| SP-S02 | Capcay | Rp35.000 |
| SP-S03 | Puyunghai | Rp35.000 |
| SP-K01 | Sop Ayam | Rp35.000 |
| SP-K02 | Sop Daging Iga | Rp35.000 |
| SP-K03 | Sop Baso | Rp35.000 |
| SP-M01 | Mie Goreng Baso | Rp35.000 |

**Porsi ½ (SKU terpisah, harga dari struk):**

| SKU | Produk | Harga | Parent |
|-----|--------|-------|--------|
| SP-A01H | Ayam Goreng Terasi Jeruk (1/2) | Rp50.000 | SP-A01 |
| SP-I01H | Udang Bakar Saus Jimbaran (1/2) | Rp50.000 | SP-I01 |
| SP-T01H | Telur Ceplok Saus Tiram (1/2) | Rp25.000 | SP-T01 |
| SP-S01H | Terong Balado (1/2) | Rp20.000 | SP-S01 |
| SP-S02H | Capcay (1/2) | Rp20.000 | SP-S02 |
| SP-S03H | Puyunghai 1/2 | Rp20.000 | SP-S03 |
| SP-K01H | Sop Ayam 1/2 | Rp20.000 | SP-K01 |
| SP-M01H | Mie Goreng Baso 1/2 | Rp20.000 | SP-M01 |
| SP-D01H | Beef Yakiniku (1/2) | Rp50.000 | SP-D01 |

---

## 2. Infrastruktur & Free Tier

### 2.1 Stack

| Layer | Service | Tier | Batasan |
|-------|---------|------|---------|
| Database | **Neon PostgreSQL** | Free | 512MB, auto-suspend |
| Hosting | **Vercel** | Hobby | 1 cron/hari max |
| Cache | **Upstash Redis** | Free (Fase 2) | 256MB, 500K cmd/hari |

### 2.2 Vercel Cron (RFM Refresh)

```json
{
  "crons": [
    {
      "path": "/api/cron/rfm-refresh",
      "schedule": "30 18 * * *"
    }
  ]
}
```
`30 18 * * *` = 18:30 UTC = **01:30 WIB** setiap hari.

### 2.3 Estimasi Storage Neon Free

| Kategori | Baris/Bulan | Storage/Bulan |
|----------|-------------|---------------|
| orders + order_items | ~650 + ~2.000 | ~1.3MB |
| customers | ~200 baru | ~200KB |
| journals + kas_mutasi | ~700 + ~700 | ~1.1MB |
| **Total/bulan** | | **~2.6MB** |
| **12 bulan** | | **~31MB** (aman < 512MB) |

### 2.4 Environment Variables

```bash
DATABASE_URL=postgresql://...@neon.tech/neondb?sslmode=require
CRON_SECRET=your-random-secret-here
```

---

## 3. Pengguna & Role

| Role | Akses | User |
|------|-------|------|
| `CS_SS` | Input order, lihat customer, cetak struk | Wanti Nova, Dewi Anggraini |
| `Keuangan_SS` | HPP, biaya, CoA, laporan keuangan | Nisa |
| `Owner` | Full access + analitik + semua master | Owner |

### Matriks Hak Akses

| Modul | CS_SS | Keuangan | Owner |
|-------|:-----:|:--------:|:-----:|
| Dashboard | ✓ | ✓ | ✓ |
| Buat / Lihat / Batalkan Order | ✓ | ✓ | ✓ |
| Master Produk (lihat) | ✓ | ✓ | ✓ |
| Master Produk (kelola) | ✕ | ✕ | ✓ |
| Master Channel | ✕ | ✕ | ✓ |
| Master Wilayah (Areas) | ✕ | ✕ | ✓ |
| **Master Tarif Ongkir (Matriks)** | ✕ | ✕ | ✓ |
| Master Customer | ✓ | ✓ | ✓ |
| Pembelian / HPP | ✕ | ✓ | ✓ |
| Biaya Operasional | ✕ | ✓ | ✓ |
| CoA & Kas Bank | ✕ | ✓ | ✓ |
| Laporan Keuangan | ✕ | ✓ | ✓ |
| Analisa RFM & Produk | ✕ | ✓ | ✓ |

---

## 4. Arsitektur Data v4

### 4.1 Diagram Relasi Lengkap

```
shipping_zones ◄──── areas ──────────────── customers
  (zone_key)        (shipping_zone,          (area_id,
                     kecamatan, kota)         patokan, lini)
                         │                        │
                         ▼                        │
              area_channel_shipping ◄── channels  │
              (area_id, channel_id,    (id, name, │
               shipping_fee) ←NEW v4   harga_type)│
                                            │      │
              product_channels             │      │
              (product_id, channel_id,     │      │
               harga_override)             │      │
                    │                      │      │
                    ▼                      ▼      ▼
                products               orders ────────── order_items
                (sku, lini,           (channel_id,
                 is_half_portion,      no_struk, lini,
                 parent_sku)           shipping_fee,    ← snapshot
                                       shipping_zone,   ← snapshot
                                       payment_bank,
                                       journal_id)

   get_shipping_fee(area_id, channel_id)   ← FUNCTION baru v4
   1. area_channel_shipping spesifik
   2. shipping_zones via areas.shipping_zone
   3. 0 (fallback akhir)

coa ◄──── journals (akun_debit, akun_kredit) ────► coa
kas_bank ◄── kas_mutasi
purchases ──► coa, kas_bank

rfm_scores (Materialized View) ← refresh 01:30 WIB
```

### 4.2 Tabel Baru v4: `area_channel_shipping`

```sql
CREATE TABLE area_channel_shipping (
    area_id      int8          NOT NULL,  -- FK areas.id
    channel_id   int8          NOT NULL,  -- FK channels.id
    shipping_fee numeric(15,2) NOT NULL,
    is_active    boolean       NOT NULL DEFAULT true,
    notes        text,                    -- "Marketplace gratis ongkir"
    PRIMARY KEY (area_id, channel_id)
);
```

**Aturan:** Tidak perlu isi semua kombinasi. Hanya isi kombinasi yang berbeda dari default zona. Sistem akan fallback ke `shipping_zones` jika tidak ada baris spesifik.

### 4.3 Function `get_shipping_fee(area_id, channel_id)`

```sql
-- Hierarki 3 level:
-- 1. Spesifik area × channel → area_channel_shipping
-- 2. Zona default → shipping_zones via areas.shipping_zone
-- 3. Fallback → 0

SELECT public.get_shipping_fee(:area_id, :channel_id) AS ongkir;
```

Dipanggil di:
- Form order baru (saat CS pilih kecamatan & channel)
- Kalkulasi preview total sebelum simpan
- Seed data (agar konsisten dengan logika bisnis)

### 4.4 Semua Tabel (Ringkasan Lengkap)

**Eksisting (ALTER — tambah kolom):**

| Tabel | Kolom Baru |
|-------|-----------|
| `products` | `sku`, `lini`, `is_half_portion`, `parent_sku`, `harga_marketplace` |
| `customers` | `area_id` (FK areas), `patokan`, `lini` |
| `orders` | `lini`, `channel_id`, `no_struk`, `input_source`, `platform_ref`, `shipping_zone`, `payment_bank`, `payment_account`, `cancel_reason`, `cancelled_by`, `cancelled_at`, `journal_id` |
| `overheads` | `lini` |

**Baru (Master):**

| Tabel | Fungsi |
|-------|--------|
| `areas` | Kecamatan dinamis + zona default ongkir |
| `shipping_zones` | Tarif default per zona (fallback level-2) |
| `channels` | Channel penjualan dinamis |
| **`area_channel_shipping`** | **Matriks ongkir area × channel (v4)** |
| `product_channels` | Junction produk × channel + harga override |
| `settings` | Config, counter struk, RFM status |

**Baru (Akuntansi Terpadu):**

| Tabel | Fungsi |
|-------|--------|
| `coa` | Chart of accounts per lini |
| `kas_bank` | Rekening kas & bank per lini |
| `kas_mutasi` | Mutasi per rekening |
| `purchases` | HPP / nota belanja per lini |
| `journals` | Buku jurnal double-entry per lini |

---

## 5. Sistem Ongkir Dinamis (v4)

### 5.1 Hierarki Lookup Fee

```
get_shipping_fee(area_id, channel_id)
        │
        ▼
  Cek area_channel_shipping
  WHERE area_id = ? AND channel_id = ? AND is_active = true
        │
        ├── Found → gunakan shipping_fee dari sini (SPESIFIK)
        │
        └── Not Found →
                │
                ▼
          Cek shipping_zones
          via areas.shipping_zone
                │
                ├── Found → gunakan fee zona default
                │
                └── Not Found → return 0
```

### 5.2 Data Ongkir Seed (area_channel_shipping)

| Channel | Semua Area | Keterangan |
|---------|-----------|------------|
| **Marketplace** | Rp0 | Gratis ongkir, ditanggung platform |
| **Ahsan** | Rp15.000 | Flat semua area |
| **Walk-in** | Rp0 | Tidak ada ongkir (datang langsung) |
| **WhatsApp Direct** | *(tidak diisi)* | Pakai fallback zona (12k/14k) |
| **Gojek Offline** | *(tidak diisi)* | Pakai fallback zona default |
| Gojek × Cimenyan | Rp16.000 | Override — akses susah |
| Gojek × Cileunyi | Rp13.000 | Override — negosiasi khusus driver |

Zona default (`shipping_zones`):
- `dalam_kota` (Kota Bandung) → Rp12.000
- `luar_kota` (Kota Cimahi, Kab. Bandung) → Rp14.000

### 5.3 Hasil Efektif per Kombinasi (Contoh)

| Kecamatan | Gojek | Ahsan | Marketplace | Walk-in | WA |
|-----------|-------|-------|-------------|---------|-----|
| Rancasari | 12k *(zona)* | 15k *(acs)* | 0 *(acs)* | 0 *(acs)* | 12k *(zona)* |
| Cimahi Utara | 14k *(zona)* | 15k *(acs)* | 0 *(acs)* | 0 *(acs)* | 14k *(zona)* |
| Cileunyi | **13k** *(acs override)* | 15k *(acs)* | 0 *(acs)* | 0 *(acs)* | 14k *(zona)* |
| Cimenyan | **16k** *(acs override)* | 15k *(acs)* | 0 *(acs)* | 0 *(acs)* | 14k *(zona)* |

`(zona)` = dari `shipping_zones` via fallback. `(acs)` = dari `area_channel_shipping`.

### 5.4 Cara Mengelola Ongkir (di UI Master Shipping)

**Tampilan matriks** via `v_shipping_matrix`:

```
KELOLA TARIF ONGKIR
Filter: [ Semua Channel ▼ ] [ Semua Wilayah ▼ ]

Kecamatan      │ Zona    │ Gojek        │ Ahsan  │ Marketplace │ WA
───────────────┼─────────┼──────────────┼────────┼─────────────┼───────
Rancasari      │ dalam   │ 12.000 (def) │ 15.000 │ 0           │ 12.000 (def)
Cimahi Utara   │ luar    │ 14.000 (def) │ 15.000 │ 0           │ 14.000 (def)
Cileunyi       │ luar    │ 13.000 ✎    │ 15.000 │ 0           │ 14.000 (def)
Cimenyan       │ luar    │ 16.000 ✎    │ 15.000 │ 0           │ 14.000 (def)

(def) = pakai zona default | ✎ = ada override spesifik
```

**Skenario perubahan:**

*Ubah Ahsan dari flat 15k menjadi 17k:*
```sql
UPDATE area_channel_shipping
SET shipping_fee = 17000, updated_at = NOW()
WHERE channel_id = (SELECT id FROM channels WHERE name='Ahsan');
-- Efektif langsung untuk order baru
```

*Tambah channel GrabFood dengan tarif sendiri:*
```sql
-- 1. Tambah channel
INSERT INTO channels (name, lini, harga_type, urutan) VALUES ('GrabFood','siap_saji','normal',6);
-- 2. Isi tarif (atau biarkan pakai fallback zona)
INSERT INTO area_channel_shipping (area_id, channel_id, shipping_fee)
SELECT a.id, ch.id, 0 FROM areas a CROSS JOIN channels ch
WHERE ch.name='GrabFood'; -- GrabFood gratis ongkir
```

*Naik tarif zona default dalam_kota dari 12k ke 13k:*
```sql
UPDATE shipping_zones SET fee = 13000 WHERE zone_key = 'dalam_kota';
-- Efektif untuk semua area yang BELUM ada entry spesifik di acs
-- Area yang punya acs override TIDAK terpengaruh
```

### 5.5 Snapshot Ongkir di Order

`orders.shipping_fee` = nilai aktual yang dibayar customer saat itu. Tidak berubah meski tarif diupdate setelah order dibuat.

`orders.shipping_zone` = zona snapshot (untuk rekap laporan per zona).

---

## 6. Modul Penjualan

### 6.1 Alur Form Order Baru

```
1. Pilih Channel
   → Dropdown dari channels (is_active=true, lini=siap_saji)
        ↓
2. Input / Cari Customer via No HP
   → Found: tampilkan nama, kecamatan, patokan — konfirmasi
   → Not found: form (Nama, No HP, Kecamatan dari dropdown areas,
                Alamat lengkap, Patokan/Landmark)
        ↓
3. Ongkir otomatis terisi via get_shipping_fee(area_id, channel_id)
   → Tampil di form: "Biaya Kirim: Rp12.000"
   → CS bisa override manual jika ada kasus khusus
        ↓
4. Pilih Produk & Qty
   → Filter produk by channel (product_channels)
   → Harga: COALESCE(harga_override, price)
   → Porsi ½ muncul di bawah porsi penuh (urut is_half_portion)
   → Setiap baris: ada field Catatan/Note (opsional)
        ↓
5. Pilih Rekening Pembayaran
   → Default: BCA 2832835545 (is_payment_default=true)
   → Opsi: Mandiri 1310017802705
        ↓
6. Simpan Order
   → Generate no_struk: SI.YYYY.MM.{counter+1}
   → INSERT orders + order_items
   → INSERT journals (Debit Kas/Bank, Kredit Pendapatan)
   → INSERT kas_mutasi
   → UPDATE settings counter
   → Status: Aktif (langsung final, tidak ada status proses)
        ↓
7. Output otomatis:
   → v_laporan_harian_ss ter-update (produksi)
   → v_daftar_order_ss ter-update (pengiriman)
   → v_rekap_harian_ss ter-update (rekap CS)
```

### 6.2 Nomor Struk

```
SI . YYYY . MM . NNNNN
SI.2026.06.00267  ← lanjut dari 266 (counter seed)
```

Counter per bulan di `settings.ss_struk_counter_YYYY_MM`. Increment atomic via PostgreSQL transaction.

### 6.3 Pembatalan

- `cancel_reason` wajib (min 10 karakter)
- Soft-cancel: `status_order = 'Dibatalkan'`
- Reverse journal otomatis (Debit Pendapatan, Kredit Kas)
- Dikecualikan dari semua view & laporan harian

---

## 7. Modul Master Data

### 7.1 Master Produk

Kolom kunci:
- `sku` — identifier unik (SP-A01, SP-A01H, dll.)
- `is_half_portion` — toggle varian ½
- `parent_sku` — FK ke SKU porsi penuh
- Ketersediaan & harga per channel → `product_channels`

Saat CS pilih produk di form order:
```sql
SELECT p.sku, p.name, p.is_half_portion,
       COALESCE(pc.harga_override, p.price) AS harga_jual
FROM products p
JOIN product_channels pc ON pc.product_id=p.id AND pc.channel_id=:ch_id
WHERE p.lini='siap_saji' AND p.status='Aktif' AND pc.is_active=true
ORDER BY p.is_half_portion ASC, p.name ASC;
```

### 7.2 Master Channel

Tambah channel baru = 1 INSERT ke `channels`. Langsung muncul di dropdown. Tarif ongkir channel baru: isi `area_channel_shipping` atau biarkan pakai zona default.

### 7.3 Master Wilayah & Ongkir

**Wilayah** (`areas`): 32 kecamatan — 23 Kota Bandung, 3 Kota Cimahi, 6 Kab. Bandung.

**Ongkir** dikelola di 2 tempat:
- `shipping_zones` → default per zona (2 zona saat ini)
- `area_channel_shipping` → override spesifik per area × channel

UI Master Shipping menampilkan `v_shipping_matrix` — matriks `fee_efektif` lengkap per area × channel dengan indikator sumber fee (spesifik vs zona default).

### 7.4 Master Customer

Field penting:
- `phone` — identifier unik (unique key)
- `address` — alamat lengkap
- `patokan` — landmark terpisah (wajib untuk SS)
- `area_id → areas` — untuk lookup ongkir otomatis

Info otomatis di halaman detail:

| Info | Query |
|------|-------|
| Jumlah Order | `COUNT` orders aktif |
| Total Omset | `SUM(grand_total)` orders aktif |
| Channel Favorit | `MODE()` channel pada orders |
| Segmen RFM | Dari `rfm_scores.segmen` |
| Riwayat Order | List order terbaru |

---

## 8. Modul Keuangan

### 8.1 Struktur P&L

```
PENDAPATAN
  Penjualan SS (termasuk ongkir)           Rp xxx.xxx
─────────────────────────────────────────────────────
TOTAL PENDAPATAN                            Rp xxx.xxx

HPP
  HPP Bahan Baku SS                        Rp xxx.xxx
  HPP Kemasan SS                           Rp xxx.xxx
─────────────────────────────────────────────────────
TOTAL HPP                                  Rp xxx.xxx

LABA KOTOR                                 Rp xxx.xxx

BIAYA OPERASIONAL
  Gaji Karyawan                            Rp xxx.xxx
  Listrik & Air                            Rp xxx.xxx
  Sewa Dapur                               Rp xxx.xxx
  Transport                                Rp xxx.xxx
  Marketing                                Rp xxx.xxx
  Perlengkapan                             Rp xxx.xxx
─────────────────────────────────────────────────────
TOTAL BIAYA OPERASIONAL                    Rp xxx.xxx

LABA BERSIH                                Rp xxx.xxx
```

HPP = akumulasi `purchases.total_amount` per periode. **Tidak ada BOM/resep per SKU.**

### 8.2 Jurnal Otomatis

| Event | Debit | Kredit |
|-------|-------|--------|
| Order baru (BCA) | Bank BCA (1-1002) | Pendapatan SS (4-1001) |
| Order baru (Mandiri) | Bank Mandiri (1-1003) | Pendapatan SS (4-1001) |
| Order dibatalkan | Pendapatan SS (4-1001) | Bank sesuai |
| Pembelian bahan | HPP Bahan Baku (5-1001) | Bank |
| Pembelian kemasan | HPP Kemasan (5-1002) | Bank |
| Biaya gaji | Beban Gaji (6-1001) | Bank |
| Modal masuk | Bank | Modal (3-1001) |

### 8.3 Kesiapan Catering (Fase 2)

Onboarding Catering ke akuntansi = INSERT data saja:
```sql
INSERT INTO coa (lini='catering', kode_akun, ...) ...;
INSERT INTO kas_bank (lini='catering', ...) ...;
-- Jurnal Catering via ref_type='realisasi_po'
```
Tidak perlu ALTER TABLE atau tabel baru.

---

## 9. Modul Analitik — RFM

### 9.1 Kapan Di-generate

| Trigger | Kapan | Cara |
|---------|-------|------|
| **Scheduled** | Setiap hari 01:30 WIB | Vercel Cron → `/api/cron/rfm-refresh` |
| **On-demand** | Tombol "Refresh" di UI | API call sama, dipicu dari Owner/Keuangan |

Status di UI: *"Data per 15 Agustus 2026, 01:30 | [Refresh Manual]"*

### 9.2 Skoring: Quintile Dinamis NTILE(5)

```sql
r_score = 6 - NTILE(5) OVER (ORDER BY recency_days ASC)  -- hari sedikit = skor tinggi
f_score = NTILE(5) OVER (ORDER BY frequency ASC)
m_score = NTILE(5) OVER (ORDER BY monetary ASC)
```

Tidak ada hardcode threshold. Distribusi dihitung ulang setiap refresh dari data aktual.

### 9.3 Segmentasi

| Segmen | Kriteria | Aksi |
|--------|----------|------|
| **Champions** | R≥4, F≥4, M≥4 | Reward, pertahankan |
| **Loyal Customers** | F≥4, (R+M)≥6 | Program loyalitas |
| **New Customers** | R≥4, F≤2, M≤2 | Welcome offer |
| **Potential Loyalist** | Selain di atas | Nurture |
| **At Risk** | R≤2, (F≥3 atau M≥3) | Follow-up aktif WA |
| **Dormant** | R≤2, F≤2, M≤2 | Re-engagement |

### 9.4 Analisa Produk

- Top terlaris by Qty & Revenue, filter periode & channel
- Porsi penuh vs ½ tampil terpisah, dikelompokkan via `parent_sku`
- Tren pertumbuhan per bulan
- Klasifikasi ABC (Pareto ~80% revenue)
- Produk slow-moving (tidak terjual > N hari)
- Performa per channel

---

## 10. Dashboard

Default: **Hari Ini** (toggle: 7 hari / 30 hari / custom)

| Widget | Data | Catatan |
|--------|------|---------|
| Total Penjualan | `SUM(grand_total)` | vs kemarin (delta %) |
| Total Order | `COUNT` aktif | vs kemarin |
| Channel Terbanyak | Mode channel | Jumlah order |
| Produk Terjual | `SUM(quantity)` | — |
| **+ Buat Penjualan** | Tombol aksi | Satu-satunya shortcut |
| Penjualan 7 Hari | Line chart | Sesuai mockup UI |
| Top 5 Produk | Bar + nilai omset | Mengikuti filter |
| Top 5 Customer | Ranking + omset + segmen RFM | Mengikuti filter |

Brand colors: **Purple, Pink, Yellow** (sesuai mockup).

---

## 11. Dokumen Operasional Harian

**Prinsip: 1× input → 4× output otomatis**

### 11.1 Struk Penjualan

Format sesuai nota PDF asli:

```
  DYummy Catering                     ← settings.brand_name_struk
  Jl Sindangsari 4 No 48              ← settings.brand_address_struk
  Kota Bandung Jawa Barat
  Indonesia

  SI.2026.06.00263 - 18/06/2026       ← no_struk - delivery_date

Ibu Elly                              ← customers.name
Jl Pluto I Blok C No 5 Kec Rancasari ← customers.address
Kel Margasari-Patokan : Dekat Griya  ← "-Patokan : " + customers.patokan
Margahayuraya...

Nama Barang              Total Harga

Sop Ayam
1 x 35,000                    35.000
Telur Ceplok Saus Tiram
1 x 50,000                    50.000
Puyunghai
1 x 35,000                    35.000

Biaya Kirim
1 x 12,000                    12.000
Sub Total                    132.000
Diskon                             0
Total                        132.000

      Wanti Nova, 18 Jun 2026, 06:37  ← users.name + created_at
```

### 11.2 Laporan Penjualan Harian → Produksi

Sumber: `v_laporan_harian_ss`

```
LAPORAN PENJUALAN HARIAN — DYUMMY CATERING
Tanggal: 18 Juni 2026 | Channel: Semua
─────────────────────────────────────────────────────
No │ Nama Barang                    │ Porsi │ Qty
───┼────────────────────────────────┼───────┼─────
1  │ Ayam Goreng Terasi Jeruk       │ Penuh │  5
2  │ Ayam Goreng Terasi Jeruk (1/2) │ 1/2   │  1
3  │ Beef Yakiniku                  │ Penuh │  5
4  │ Mie Goreng Baso                │ Penuh │  4
   ...
─────────────────────────────────────────────────────
Total Qty: 65 porsi
```

### 11.3 Daftar Order → Pengiriman

Sumber: `v_daftar_order_ss` — urut channel → zona → kecamatan

```
DAFTAR ORDER — 18 JUNI 2026
══════════════════════════════════
GOJEK OFFLINE | ZONA: DALAM KOTA
──────────────────────────────────
KECAMATAN: RANCASARI
No │ Nama     │ No HP   │ Alamat   │ Patokan       │ Order        │ Total
1  │ Ibu Elly │ 0811... │ Jl Pluto │ Dekat Griya.. │ Sop Ayam ×1  │ Rp132.000
   │          │         │          │               │ Telur ×1     │
   │          │         │          │               │ Puyunghai ×1 │

══════════════════════════════════
GOJEK OFFLINE | ZONA: LUAR KOTA
──────────────────────────────────
KECAMATAN: CIMAHI UTARA
...
```

### 11.4 Rekap Tabel → CS (Pengganti Sheet Manual)

Sumber: `v_rekap_harian_ss`

| Pelanggan | Penjualan | (Sudah Termasuk Ongkir) | Rekening | Status |
|-----------|-----------|------------------------|----------|--------|
| nane aprilia lestari | Rp85.000 | Rp12.000 | BCA 2832835545 | LUNAS |
| Irham | Rp100.000 | Rp12.000 | BCA 2832835545 | LUNAS |
| Ibu Elly | Rp120.000 | Rp12.000 | BCA 2832835545 | LUNAS |
| ... | | | | |

Persis format rekap manual yang dipakai CS selama ini.

---

## 12. Kebutuhan Non-Fungsional

### 12.1 Index Penting

```sql
-- Order hot-path
idx_orders_lini_date     ON orders (lini, delivery_date) WHERE status_order<>'Dibatalkan'
idx_orders_no_struk      ON orders (no_struk) WHERE no_struk IS NOT NULL
idx_orders_channel       ON orders (channel_id)

-- Lookup ongkir
idx_acs_area             ON area_channel_shipping (area_id)
idx_acs_channel          ON area_channel_shipping (channel_id)

-- Customer
idx_customers_phone      ON customers (phone)
idx_customers_area       ON customers (area_id)

-- Analitik
rfm_scores_customer_id   UNIQUE ON rfm_scores (customer_id)
idx_journals_lini_date   ON journals (lini, journal_date)
```

### 12.2 Keamanan & Integritas

| Aspek | Detail |
|-------|--------|
| Snapshot fee | `orders.shipping_fee` tidak berubah meski tarif diupdate |
| Snapshot harga | `order_items.price` = harga saat transaksi |
| Soft-delete | `status_order='Dibatalkan'` — data tidak dihapus |
| Cron auth | Header `Authorization: Bearer ${CRON_SECRET}` |
| Brand name | Di `settings`, bukan hardcode |
| Audit trail | `cancelled_by`, `cancelled_at`, `created_at`, `updated_at` |

### 12.3 Neon Auto-Suspend

`REFRESH MATERIALIZED VIEW CONCURRENTLY` butuh koneksi aktif. Handle cold start di API route:

```typescript
// Retry connection jika Neon sedang suspend
async function withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try { return await fn(); }
    catch (e) {
      if (i === retries - 1) throw e;
      await new Promise(r => setTimeout(r, 2000 * (i + 1)));
    }
  }
  throw new Error('Max retries exceeded');
}
```

---

## 13. Roadmap

### Fase 1 — Dokumen Ini

- [x] Schema v4.0 (area_channel_shipping + function get_shipping_fee)
- [x] Seed 23 customer + 23 order nyata + matriks ongkir per channel
- [ ] Form order baru (ongkir otomatis via get_shipping_fee)
- [ ] Struk digital (format = nota asli, patokan terpisah)
- [ ] Output harian: produksi + pengiriman + rekap tabel
- [ ] Master Shipping (UI matriks area × channel via v_shipping_matrix)
- [ ] Master Produk (toggle ½ porsi, product_channels)
- [ ] Master Customer (patokan, area_id)
- [ ] Keuangan: HPP, biaya, CoA, jurnal otomatis, kas & bank
- [ ] Laporan P&L, Neraca, Arus Kas
- [ ] Dashboard (10 modul sesuai mockup)
- [ ] Analisa RFM + Analisa Produk
- [ ] Vercel Cron RFM refresh

### Fase 2 — Lanjutan

- [ ] Integrasi API Marketplace (`input_source='marketplace_api'`)
- [ ] GrabFood channel onboard (1 INSERT + isi acs)
- [ ] Upstash Redis cache dashboard & RFM
- [ ] Catering onboard ke akuntansi (INSERT `lini='catering'`)
- [ ] Notifikasi: customer At Risk, produk slow-moving
- [ ] Export laporan PDF/Excel

---

## 14. Panduan Developer

### 14.1 Setup

```bash
# 1. Jalankan migration
psql $DATABASE_URL -f dyummy_v4_migration.sql

# 2. Verifikasi area_channel_shipping
psql $DATABASE_URL -c "
SELECT ch.name, COUNT(*) as jumlah_area, AVG(acs.shipping_fee) as rata_fee
FROM area_channel_shipping acs
JOIN channels ch ON ch.id = acs.channel_id
GROUP BY ch.name ORDER BY ch.name;"

# 3. Test function get_shipping_fee
psql $DATABASE_URL -c "
SELECT a.kecamatan, ch.name,
       public.get_shipping_fee(a.id, ch.id) AS fee_efektif
FROM areas a CROSS JOIN channels ch
WHERE a.kecamatan IN ('Rancasari','Cimahi Utara','Cileunyi','Cimenyan')
  AND ch.lini='siap_saji'
ORDER BY a.kecamatan, ch.urutan;"

# 4. Verifikasi seed orders
psql $DATABASE_URL -c "
SELECT no_struk, shipping_fee, grand_total, payment_bank
FROM orders WHERE lini='siap_saji'
ORDER BY no_struk;"
```

### 14.2 Query Penting

**Ongkir saat form order (setelah pilih area & channel):**
```sql
SELECT public.get_shipping_fee(:area_id, :channel_id) AS ongkir;
```

**Matriks ongkir untuk UI Master Shipping:**
```sql
SELECT * FROM v_shipping_matrix
WHERE kecamatan = 'Rancasari'
ORDER BY channel_name;
-- fee_efektif = nilai yang dipakai, sumber_fee = spesifik|zona_default
```

**Produk untuk channel tertentu (form order):**
```sql
SELECT p.sku, p.name, p.is_half_portion, p.parent_sku,
       COALESCE(pc.harga_override, p.price) AS harga_jual
FROM products p
JOIN product_channels pc ON pc.product_id=p.id
WHERE pc.channel_id=:channel_id AND pc.is_active=true
  AND p.status='Aktif' AND p.lini='siap_saji'
ORDER BY p.is_half_portion ASC, p.name ASC;
```

**Laporan produksi harian:**
```sql
SELECT * FROM v_laporan_harian_ss
WHERE tanggal = CURRENT_DATE
ORDER BY is_half_portion ASC, nama_barang ASC;
```

**Daftar pengiriman dengan patokan:**
```sql
SELECT * FROM v_daftar_order_ss
WHERE tanggal = CURRENT_DATE
ORDER BY channel,
         CASE shipping_zone WHEN 'dalam_kota' THEN 1 ELSE 2 END,
         kecamatan, nama_customer;
```

**Rekap tabel harian (pengganti sheet manual CS):**
```sql
SELECT * FROM v_rekap_harian_ss WHERE tanggal = CURRENT_DATE;
```

**Tambah channel baru dengan ongkir gratis:**
```sql
-- Step 1: tambah channel
INSERT INTO channels (name, lini, harga_type, urutan)
VALUES ('GrabFood', 'siap_saji', 'marketplace', 6)
RETURNING id;

-- Step 2: isi tarif ongkir
INSERT INTO area_channel_shipping (area_id, channel_id, shipping_fee, notes)
SELECT a.id, :new_channel_id, 0, 'GrabFood gratis ongkir'
FROM areas a WHERE a.is_active = true;

-- Step 3: isi product_channels
INSERT INTO product_channels (product_id, channel_id, harga_override)
SELECT p.id, :new_channel_id, ROUND(p.price * 1.15 / 500) * 500
FROM products p
WHERE p.lini='siap_saji' AND p.status='Aktif' AND p.is_half_portion=false;
```

**Counter struk (atomic):**
```typescript
async function nextStrukNo(db, year: number, month: number): Promise<string> {
  const key = `ss_struk_counter_${year}_${String(month).padStart(2,'0')}`;
  const result = await db.transaction(async (tx) => {
    await tx.execute(
      `INSERT INTO settings (key, value) VALUES ($1, '0')
       ON CONFLICT (key) DO NOTHING`, [key]
    );
    const r = await tx.execute(
      `UPDATE settings
       SET value = (CAST(value AS int)+1)::text, updated_at=NOW()
       WHERE key=$1 RETURNING value`, [key]
    );
    return r.rows[0].value;
  });
  return `SI.${year}.${String(month).padStart(2,'0')}.${String(result).padStart(5,'0')}`;
}
```

**Cron RFM refresh:**
```typescript
// app/api/cron/rfm-refresh/route.ts
export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`)
    return Response.json({ error: 'Unauthorized' }, { status: 401 });

  await db.execute(`UPDATE settings SET value='running', updated_at=NOW()
                    WHERE key='rfm_refresh_status'`);
  await db.execute(`REFRESH MATERIALIZED VIEW CONCURRENTLY public.rfm_scores`);
  await db.execute(`UPDATE settings SET value=NOW()::text, updated_at=NOW()
                    WHERE key='rfm_last_refresh'`);
  await db.execute(`UPDATE settings SET value='idle', updated_at=NOW()
                    WHERE key='rfm_refresh_status'`);

  return Response.json({ success: true, refreshed_at: new Date().toISOString() });
}
```

---

*PRD v4.0 — final. Semua keputusan arsitektur (channel dinamis, wilayah dinamis, ongkir per area×channel hierarkis, akuntansi terpadu siap dua lini, RFM materialized view, seed dari data operasional nyata) sudah terintegrasi penuh. Tidak ada tabel yang terlewat, tidak ada edge case yang tidak di-cover.*
