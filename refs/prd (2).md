# PRD — Modul Penggajian & Presensi
**Sistem Informasi Catering · Next.js + Neon PostgreSQL + Vercel**

> **Versi:** 1.1.0  
> **Tanggal:** 2026-09-05  
> **Status:** Draft untuk Review  
> **ERD & TRD:** dokumen terpisah

---

## 1. Latar Belakang & Konteks

Perusahaan catering saat ini menggunakan mesin fingerprint untuk mencatat presensi karyawan. Output dari fingerprint diekspor ke file Excel (format `.xls`/`.xlsx`) oleh mesin secara manual. Proses penggajian sepenuhnya dilakukan manual di Excel tanpa sistem terintegrasi, sehingga rawan kesalahan rekap, inkonsistensi data karyawan, dan lamanya waktu proses payroll setiap bulannya.

Modul ini akan diintegrasikan ke dalam sistem berbasis **Next.js** yang sudah berjalan dengan database **Neon PostgreSQL** dan di-deploy di **Vercel**.

### Temuan dari Analisis File Excel Existing

| File | Sheet | Isi |
|---|---|---|
| `AttendanceRecord.xlsx` | Daftar Catatan | Ekspor fingerprint: No, Nama, Dept, jam masuk/keluar per tanggal |
| `AllReport.xls` | Ringkasan Kehadiran | Rekapitulasi per karyawan: lama kerja, keterlambatan (menit), lembur, tidak scan, absen |
| `AllReport.xls` | Daftar Catatan | Raw log jam masuk/keluar per hari per karyawan |
| `AllReport.xls` | Perhitungan Tidak Normal | Deteksi anomali: hanya scan masuk/keluar satu kali, tidak hadir, dsb |
| `AllReport.xls` | Tabel Shift | Jadwal shift karyawan per tanggal dalam sebulan (tipe: Per. / Dept.) |
| `AllReport.xls` | Jadwal Kerja | Definisi shift: jam masuk-keluar per shift (Shift1–Shift5) |
| `AllReport.xls` | Sheet `1`, `7`, `14`, `21`, `27`, `12`, `39`, `42` | Laporan kehadiran individual per karyawan (3 karyawan per sheet) |
| `Database_Gaji_Produksi.xlsx` | Gaji Produksi | Master gaji: nama, jabatan, gaji pokok/hari, gaji/jam, lembur/jam |
| `Database_Gaji_Produksi.xlsx` | Gaji Driver | Master gaji driver: nama, jabatan, gaji pokok, lembur/jam, lembur/km |

**Pola gaji yang teridentifikasi:**
- **Karyawan Produksi**: Gaji harian (Rp 55.000–150.000/hari), lembur per jam (Rp 7.000–15.000/jam). Formula: `Gaji/Jam = Gaji Pokok / 8`.
- **Driver**: Gaji harian + lembur per jam + tunjangan per km berdasarkan tier jarak (1–5 km, 6–15 km, >15 km).
- **Tunjangan/Bonus/Pembulat**: kolom yang diisi manual oleh HRD per periode.

---

## 2. Tujuan & Sasaran

1. Menghilangkan rekap penggajian manual Excel yang error-prone.
2. HRD cukup upload satu file presensi bulanan dari fingerprint → sistem otomatis menghitung gaji.
3. Data master karyawan dan struktur gaji dikelola langsung di aplikasi (bukan di Excel).
4. Menghasilkan slip gaji digital dan rekapitulasi penggajian yang dapat diunduh.
5. Audit trail: setiap perubahan data master dan proses penggajian tercatat.

---

## 3. Pengguna (Aktor)

| Aktor | Deskripsi |
|---|---|
| **HRD / Admin Payroll** | Upload presensi, review data kehadiran, proses penggajian, cetak slip |
| **Finance / Manajer** | Approve penggajian, lihat laporan rekap biaya SDM |
| **Super Admin** | Kelola master data karyawan, jabatan, struktur gaji, shift, konfigurasi aturan potongan & lembur |

---

## 4. Struktur Menu Aplikasi

```
📁 HR & Payroll
├── 📋 Master Data
│   ├── Data Karyawan
│   ├── Jabatan & Departemen
│   ├── Struktur Gaji (Gaji Pokok & Komponen)
│   ├── Jadwal Shift
│   └── Konfigurasi Aturan Potongan & Lembur
├── 📅 Presensi
│   ├── Upload Presensi Bulanan
│   ├── Rekap Kehadiran
│   └── Koreksi Presensi
├── 💰 Penggajian
│   ├── Proses Penggajian
│   ├── Riwayat Payroll
│   └── Slip Gaji
└── 📊 Laporan
    ├── Laporan Kehadiran
    ├── Laporan Penggajian
    └── Laporan Lembur & Keterlambatan
```

---

## 5. Spesifikasi Fitur Detail

---

### 5.1 Master Data Karyawan

**Path:** `/hr/karyawan`

**Deskripsi:** Halaman CRUD untuk data karyawan. Setiap karyawan harus terdaftar di sini sebelum bisa diproses presensi dan penggajiannya.

**Field Data Karyawan:**

| Field | Tipe | Keterangan |
|---|---|---|
| `kode_karyawan` | String (auto) | Kode unik, misal `EMP-001` |
| `nama_fingerprint` | String | Nama **persis** seperti yang muncul di export fingerprint (dipakai untuk matching upload) |
| `nama_lengkap` | String | Nama lengkap resmi |
| `departemen_id` | FK | Referensi ke tabel departemen |
| `jabatan_id` | FK | Referensi ke tabel jabatan |
| `tipe_karyawan` | Enum | `TETAP`, `FREELANCE`, `TRAINING`, `DRIVER` |
| `tipe_gaji` | Enum | `HARIAN_PRODUKSI`, `HARIAN_DRIVER` |
| `tanggal_masuk` | Date | |
| `status` | Enum | `AKTIF`, `NON_AKTIF`, `CUTI_PANJANG` |
| `no_fingerprint` | Integer | Nomor ID di mesin fingerprint |
| `catatan` | Text | Opsional |

> **Penting:** Field `nama_fingerprint` digunakan sebagai kunci pencocokan saat upload file presensi. Jika nama di file fingerprint tidak cocok dengan record manapun, sistem akan menampilkan warning "Karyawan tidak ditemukan" dan meminta HRD untuk mapping manual.

**Fitur Tambahan:**
- Import karyawan dari Excel (template tersedia untuk download).
- Filter berdasarkan: departemen, jabatan, tipe karyawan, status.
- Nonaktifkan karyawan (soft delete) — data historis tetap tersimpan.

---

### 5.2 Master Jabatan & Departemen

**Path:** `/hr/jabatan` dan `/hr/departemen`

**Departemen** (contoh dari data existing):
- Company (umum/produksi)
- Production Dept.
- Driver Dept.

**Jabatan** (contoh dari data existing):

| Jabatan | Teridentifikasi di Data |
|---|---|
| Produksi | ✅ |
| Dishwash | ✅ |
| Koki | ✅ |
| Cleaning Service | ✅ |
| Karyawan Gudang | ✅ |
| Tim Gudang | ✅ |
| Tim Siap Saji | ✅ |
| Freelance | ✅ |
| Freelance Koki | ✅ |
| Training Koki | ✅ |
| Driver Motor | ✅ |
| Driver Mobil | ✅ |
| Leader Driver | ✅ |

---

### 5.3 Master Struktur Gaji

**Path:** `/hr/struktur-gaji`

Karena terdapat dua model penggajian yang berbeda (Produksi vs Driver), struktur gaji dibuat fleksibel per karyawan.

#### 5.3.1 Komponen Gaji Produksi

| Komponen | Keterangan | Contoh Nilai |
|---|---|---|
| `gaji_pokok_harian` | Gaji per hari kerja | Rp 55.000 – Rp 150.000 |
| `gaji_per_jam` | Otomatis: `gaji_pokok / 8` | Auto-kalkulasi |
| `lembur_per_jam` | Tarif lembur per jam | Rp 7.000 – Rp 15.000 |
| `tunjangan_tetap` | Tunjangan rutin (opsional) | - |

#### 5.3.2 Komponen Gaji Driver

| Komponen | Keterangan | Contoh Nilai |
|---|---|---|
| `gaji_pokok_harian` | Gaji per hari kerja | Rp 70.000 – Rp 100.000 |
| `lembur_per_jam` | Tarif lembur per jam | Rp 10.000 |
| `tunjangan_km_tier1` | Tarif per km (1–5 km) | Rp 10.000 |
| `tunjangan_km_tier2` | Tarif per km (6–15 km) | Rp 15.000 |
| `tunjangan_km_tier3` | Tarif per km (>15 km) | Rp 20.000 |

> **Catatan:** Data km perjalanan driver diinput manual oleh HRD per periode payroll karena tidak berasal dari sistem fingerprint.

**Riwayat Gaji:** Setiap perubahan struktur gaji disimpan dengan `effective_date`, sehingga histori penggajian tidak terpengaruh oleh perubahan masa depan.

---

### 5.4 Master Jadwal Shift

**Path:** `/hr/shift`

Berdasarkan data, terdapat beberapa shift yang sudah terdefinisi. Sistem perlu mengelola:

| Field | Keterangan |
|---|---|
| `nama_shift` | Misal: "Normal Shift1", "Normal Shift2" |
| `jam_masuk` | Jam mulai kerja (HH:mm) |
| `jam_keluar` | Jam selesai kerja (HH:mm) |
| `toleransi_terlambat_menit` | Batas menit masih dianggap tepat waktu |
| `jam_kerja_normal` | Jumlah jam kerja standar (default: 8 jam) |

**Penugasan Shift ke Karyawan:** Jadwal shift karyawan per bulan dapat diassign melalui halaman **Upload Presensi** atau melalui UI kalender shift.

---

### 5.5 Konfigurasi Aturan Potongan & Lembur

**Path:** `/hr/konfigurasi-aturan`

Sistem menyediakan mekanisme aturan yang **sepenuhnya fleksibel** — perusahaan dapat mengaktifkan atau menonaktifkan setiap aturan, baik secara global (berlaku untuk semua karyawan) maupun per-karyawan (override individual).

#### 5.5.1 Aturan Potongan Keterlambatan

| Setting | Tipe | Keterangan |
|---|---|---|
| `aktif` | Boolean | Toggle on/off, default: **off** |
| `mode_potongan` | Enum | `PER_MENIT` (potong sekian Rp per menit terlambat) atau `PER_KEJADIAN` (potong nominal flat per hari terlambat) |
| `tarif_per_menit` | Integer | Nominal potongan per menit keterlambatan (jika mode `PER_MENIT`) |
| `tarif_per_kejadian` | Integer | Nominal potongan flat per hari terlambat (jika mode `PER_KEJADIAN`) |
| `batas_toleransi_menit` | Integer | Menit keterlambatan yang masih ditoleransi sebelum potongan dihitung |
| `maksimum_potongan_per_hari` | Integer | Batas atas potongan keterlambatan per hari (opsional, agar tidak melebihi gaji harian) |

#### 5.5.2 Aturan Batas Maksimum Lembur

| Setting | Tipe | Keterangan |
|---|---|---|
| `aktif` | Boolean | Toggle on/off, default: **off** |
| `maksimum_jam_per_hari` | Decimal | Batas jam lembur per hari yang dapat diakui/dibayar |
| `maksimum_jam_per_bulan` | Decimal | Batas akumulasi jam lembur per bulan yang dapat diakui/dibayar |
| `perilaku_jika_melewati` | Enum | `POTONG` (jam di atas batas tidak dibayar) atau `TANDAI_SAJA` (tetap dibayar tapi ditandai untuk review HRD) |

#### 5.5.3 Override Per-Karyawan

Setiap aturan di atas dapat di-override pada level karyawan individu melalui halaman **Detail Karyawan** → tab **Aturan Khusus**:

- Karyawan tertentu dapat **dikecualikan** dari potongan keterlambatan (misal: karyawan senior, karyawan dengan perjanjian kerja khusus).
- Karyawan tertentu dapat memiliki **batas lembur berbeda** dari aturan global.
- Override per-karyawan **mendahului** aturan global; jika tidak ada override, aturan global yang berlaku.

#### 5.5.4 Visibilitas di Proses Payroll

Ketika aturan aktif, hasil kalkulasinya otomatis masuk ke preview penggajian dengan rincian terpisah:
- Baris **"Potongan Keterlambatan"** tampil di slip gaji jika ada nilai > 0.
- Baris **"Lembur (dibatasi)"** menampilkan jam aktual vs jam yang diakui jika ada pemotongan lembur.
- HRD tetap dapat mengubah nilai akhir secara manual sebelum finalisasi.

---

### 5.6 Upload Presensi Bulanan

**Path:** `/hr/presensi/upload`

Ini adalah **fitur inti** yang menggantikan proses rekap manual.

#### 5.6.1 Alur Upload

```
HRD ekspor file dari mesin fingerprint
        ↓
Upload file .xlsx / .xls ke sistem
        ↓
Sistem parsing otomatis (validasi format)
        ↓
Preview data: tampilkan karyawan terdeteksi & tidak terdeteksi
        ↓
HRD mapping karyawan yang tidak ditemukan (jika ada)
        ↓
Konfirmasi & Simpan ke database
        ↓
Data siap diproses untuk penggajian
```

#### 5.6.2 Format File yang Diterima

Sistem mendukung **dua format** ekspor dari mesin fingerprint berdasarkan data yang ada:

**Format A — `AttendanceRecord.xlsx` (Daftar Catatan):**
- Kolom: No, Nama, Dept, Tanggal (kolom), jam masuk\nkeluar per sel
- Cocok untuk: upload harian atau mingguan

**Format B — `AllReport.xls` (Ringkasan Kehadiran):**
- Sheet `Ringkasan Kehadiran`: rekapitulasi per karyawan per periode
- Sheet `Perhitungan Tidak Normal`: anomali kehadiran
- Sheet `Tabel Shift`: penugasan shift per hari
- Cocok untuk: upload bulanan lengkap (direkomendasikan)

Sistem akan **auto-detect** format berdasarkan nama sheet dan struktur kolom header.

#### 5.6.3 Template Download untuk HRD

Selain menerima file raw dari fingerprint, sistem menyediakan **template Excel standar** yang bisa diisi manual oleh HRD apabila mesin fingerprint mengalami gangguan atau ada karyawan yang tidak terdaftar di fingerprint.

**Nama file:** `template_presensi_bulanan.xlsx`

**Kolom template:**

| Kolom | Tipe | Keterangan |
|---|---|---|
| `nama_karyawan` | Text | Harus cocok dengan `nama_fingerprint` di master |
| `tanggal` | Date (YYYY-MM-DD) | Satu baris per hari kerja |
| `jam_masuk` | Time (HH:mm) | Kosong jika tidak hadir |
| `jam_keluar` | Time (HH:mm) | Kosong jika tidak hadir |
| `keterangan` | Enum | `HADIR`, `ABSEN`, `CUTI`, `SAKIT`, `IZIN`, `DINAS` |
| `catatan` | Text | Opsional |

Template bisa diunduh dari halaman upload dengan tombol **"Download Template"**.

#### 5.6.4 Validasi Data Saat Upload

| Validasi | Aksi |
|---|---|
| Nama karyawan tidak ditemukan di master | Tampilkan warning, minta mapping manual |
| Jam masuk > jam keluar (anomali) | Tandai sebagai "Tidak Normal", minta konfirmasi HRD |
| Karyawan hanya scan satu kali (masuk saja / keluar saja) | Tandai sebagai "Tidak Scan Lengkap" |
| Duplikasi data untuk karyawan + tanggal yang sama | Tampilkan error, blokir upload |
| Period overlap (sudah ada data bulan tersebut) | Warning: overwrite atau merge? |

---

### 5.7 Rekap Kehadiran

**Path:** `/hr/presensi/rekap`

| Kolom | Sumber Kalkulasi |
|---|---|
| Nama Karyawan | Master karyawan |
| Departemen | Master karyawan |
| Total Hari Kerja (Jadwal) | Jadwal shift bulan tersebut |
| Total Hari Hadir | Count dari data presensi |
| Total Hari Absen | Jadwal – Hadir |
| Hari Cuti | Dari keterangan presensi |
| Hari Sakit / Izin | Dari keterangan presensi |
| Total Terlambat (menit) | Akumulasi keterlambatan |
| Total Lembur (menit) | Akumulasi menit di atas jam kerja normal |
| Tidak Scan Lengkap | Count hari hanya scan sekali |

**Filter:** Bulan/tahun, departemen, karyawan. **Export:** Excel.

---

### 5.8 Koreksi Presensi

**Path:** `/hr/presensi/koreksi`

HRD dapat mengubah data presensi setelah upload (sebelum diproses ke penggajian):
- Edit jam masuk/keluar individual
- Ubah keterangan (Absen → Izin, dsb.)
- Tambah data manual (karyawan lupa scan)
- Setiap koreksi dicatat dalam **audit log**: siapa yang mengubah, kapan, nilai sebelum dan sesudah.

> **Kunci:** Koreksi hanya bisa dilakukan **sebelum** payroll diproses. Setelah payroll difinalisasi, data presensi terkunci (read-only).

---

### 5.9 Proses Penggajian

**Path:** `/hr/payroll/proses`

#### 5.9.1 Alur Proses Payroll

```
Pilih periode (bulan/tahun)
        ↓
Sistem verifikasi: data presensi sudah lengkap?
        ↓
Klik "Hitung Gaji"
        ↓
Sistem menghitung otomatis untuk semua karyawan
(termasuk kalkulasi potongan & batas lembur jika aturan aktif)
        ↓
Preview hasil perhitungan (tabel per karyawan)
        ↓
HRD dapat adjustment manual (tunjangan, potongan, bonus)
        ↓
Kirim ke Finance untuk Approve
        ↓
Finance Approve → Status: FINAL
        ↓
Generate slip gaji (PDF/Excel)
```

#### 5.9.2 Formula Perhitungan Gaji Produksi

```
Jam Lembur Diakui = MIN(Total Jam Lembur Aktual, Batas Maks Lembur)
                    [jika aturan batas lembur tidak aktif → pakai nilai aktual]

Potongan Terlambat = f(mode, tarif, total menit terlambat)
                     [jika aturan potongan tidak aktif → 0]

Gaji Kotor = (Gaji Pokok Harian × Hari Hadir)
           + (Lembur/Jam × Jam Lembur Diakui)
           + Tunjangan/Bonus (input manual)
           - Potongan Terlambat
           - Potongan Lainnya (kasbon, dsb.)

Gaji Bersih = Gaji Kotor - Potongan Lainnya
```

#### 5.9.3 Formula Perhitungan Gaji Driver

```
Jam Lembur Diakui = MIN(Total Jam Lembur Aktual, Batas Maks Lembur)
                    [jika aturan batas lembur tidak aktif → pakai nilai aktual]

Potongan Terlambat = f(mode, tarif, total menit terlambat)
                     [jika aturan potongan tidak aktif → 0]

Gaji Kotor = (Gaji Pokok Harian × Hari Hadir)
           + (Lembur/Jam × Jam Lembur Diakui)
           + Tunjangan KM (input manual per driver)
           + Tunjangan/Bonus (input manual)
           - Potongan Terlambat
           - Potongan Lainnya

Gaji Bersih = Gaji Kotor - Potongan Lainnya
```

#### 5.9.4 Kolom Input Manual oleh HRD saat Payroll

| Kolom | Keterangan |
|---|---|
| `tunjangan_bonus` | Bonus/insentif tidak rutin |
| `pembulatan` | Pembulatan ke angka tertentu |
| `potongan_lain` | Misal: kasbon, kerusakan alat |
| `catatan_payroll` | Catatan untuk slip gaji |
| `km_perjalanan` | Khusus driver: total km bulan ini (per driver) |
| `override_lembur_diakui` | Override manual jam lembur yang dibayar (jika ada kasus khusus) |
| `override_potongan_terlambat` | Override manual nilai potongan terlambat |

#### 5.9.5 Status Payroll

| Status | Deskripsi |
|---|---|
| `DRAFT` | Baru dihitung, belum diapprove |
| `PENDING_APPROVAL` | Dikirim ke Finance untuk review |
| `APPROVED` | Disetujui Finance, menunggu pembayaran |
| `FINAL` | Telah dibayar, data terkunci |
| `CANCELLED` | Dibatalkan (misal ada kesalahan major) |

---

### 5.10 Riwayat Payroll

**Path:** `/hr/payroll/riwayat`

Daftar semua periode payroll yang pernah diproses, dengan filter bulan/tahun dan status. Klik periode untuk melihat detail per karyawan.

---

### 5.11 Slip Gaji

**Path:** `/hr/payroll/slip`

- Slip gaji dapat dicetak/diunduh per karyawan (PDF) atau batch semua karyawan.
- **Konten slip gaji:**
  - Logo & nama perusahaan
  - Nama karyawan, jabatan, departemen
  - Periode gaji
  - Rincian komponen pendapatan (gaji pokok, lembur, tunjangan)
  - Rincian potongan (termasuk potongan keterlambatan jika aktif dan > 0)
  - Total gaji bersih
  - Tanda tangan digital / cap perusahaan (opsional)

---

### 5.12 Laporan

**Path:** `/hr/laporan`

| Laporan | Deskripsi |
|---|---|
| Laporan Kehadiran Bulanan | Rekap hadir/absen/terlambat per karyawan per bulan |
| Laporan Lembur | Daftar jam lembur aktual vs diakui, biaya lembur total |
| Laporan Penggajian | Total gaji per departemen, per periode |
| Laporan Anomali Presensi | Karyawan dengan "Tidak Scan Lengkap", sering absen, dsb |

Semua laporan dapat diexport ke **Excel** dan **PDF**.

---

## 6. Mekanisme Improving (Roadmap)

> Fase pengembangan tidak dibagi secara rigid. Bagian ini berfungsi sebagai **peta prioritas** dan **konteks arsitektur** agar fitur-fitur lanjutan tidak menyebabkan rework besar saat diimplementasikan.

### 6.1 Yang Dibangun Sekarang (MVP)

- Master karyawan, jabatan, departemen
- Master struktur gaji (produksi & driver) dengan versioning `effective_date`
- Konfigurasi aturan potongan keterlambatan & batas lembur (tersedia, default off)
- Upload presensi dari file fingerprint (Format A & B) + template manual
- Hitung gaji otomatis + input manual adjustment
- Rekap kehadiran bulanan
- Koreksi presensi dengan audit log
- Approval workflow Finance (multi-role)
- Dashboard ringkasan: total karyawan aktif, total gaji bulan ini, absensi rate
- Laporan lembur & analitik keterlambatan
- Slip gaji PDF (cetak satuan & batch)

### 6.2 Fitur yang Disiapkan Arsitekturnya Tapi Tidak Dibangun Sekarang

Fitur-fitur berikut **tidak dibangun di fase ini** namun skema database dan arsitektur backend harus **sudah mengakomodasinya** agar tidak perlu migrasi besar:

| Fitur | Catatan Arsitektur |
|---|---|
| **Notifikasi email** (payroll siap review, dsb.) | Siapkan kolom `email` di tabel karyawan & user; siapkan enum event notifikasi |
| **Integrasi fingerprint langsung via API/SDK** | Desain tabel `hr_attendances` agar field `source` bisa membedakan `UPLOAD` vs `API_REALTIME` |
| **Portal karyawan** (lihat slip & rekap kehadiran sendiri) | Role `KARYAWAN` sudah ada di enum roles meski belum diaktifkan; slip gaji disimpan sebagai file yang bisa di-share |
| **Kalkulasi PPh 21** | Simpan NPWP & status PTKP di tabel karyawan; komponen gaji sudah terstruktur per-baris agar bisa dijumlah sebagai dasar PKP |
| **Alert otomatis** (absensi/lembur berlebih) | Threshold batas lembur di konfigurasi aturan sudah menyimpan nilai ini; tinggal tambahkan job scheduler |
| **Integrasi modul keuangan/kasir** | Tabel `hr_payrolls` menyediakan kolom `external_ref_id` untuk mapping ke transaksi di modul lain |
| **BPJS Ketenagakerjaan & Kesehatan** | Siapkan kolom `bpjs_ketenagakerjaan` dan `bpjs_kesehatan` di struktur gaji, isi null untuk saat ini |

### 6.3 Prinsip Improving Data Master

| Aspek | Mekanisme |
|---|---|
| **Karyawan baru** | Tambah via form di aplikasi, bukan di Excel |
| **Perubahan gaji** | Update di Master Struktur Gaji dengan `effective_date`, tidak menimpa histori |
| **Karyawan resign** | Soft-delete (nonaktifkan), data histori tetap ada |
| **Jabatan/Dept baru** | Tambah via CRUD di Master Jabatan, langsung tersedia di form karyawan |
| **Perubahan shift** | Edit di Master Shift, berlaku untuk penugasan selanjutnya |
| **Perubahan aturan potongan/lembur** | Perubahan konfigurasi hanya berlaku untuk payroll periode berikutnya; snapshot aturan yang berlaku disimpan di setiap record payroll |

---

## 7. Ketentuan Teknis

### 7.1 Stack & Integrasi

| Layer | Teknologi |
|---|---|
| Frontend | Next.js (App Router) |
| Backend | Next.js API Routes / Server Actions |
| Database | Neon PostgreSQL |
| Deploy | Vercel |
| File Upload | Vercel Blob / server-side parsing dengan `xlsx` npm package |
| PDF Generation | `@react-pdf/renderer` atau `puppeteer` (via serverless) |
| Auth | Existing auth sistem (role-based) |

### 7.2 Parsing File Excel

Library yang digunakan: **`xlsx` (SheetJS)** — sudah support `.xls` (xlrd compat) dan `.xlsx`.

```typescript
// Contoh parsing di API Route
import * as XLSX from 'xlsx';

export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get('file') as File;
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  // ...
}
```

### 7.3 Naming Convention Database

Semua tabel menggunakan prefix `hr_` untuk namespace yang jelas:
- `hr_employees`, `hr_departments`, `hr_positions`
- `hr_salary_structures`, `hr_salary_history`
- `hr_shifts`, `hr_shift_assignments`
- `hr_attendances`, `hr_attendance_uploads`
- `hr_payrolls`, `hr_payroll_details`
- `hr_payroll_rules` ← tabel konfigurasi aturan potongan & lembur
- `hr_payroll_rule_overrides` ← override per-karyawan

### 7.4 Snapshot Aturan di Payroll

Setiap record `hr_payroll_details` menyimpan **snapshot** nilai aturan yang digunakan saat perhitungan (tarif potongan, batas lembur, dsb.) sebagai JSONB. Ini memastikan audit trail yang akurat meskipun aturan global berubah di periode berikutnya.

### 7.5 File Upload Constraint

| Parameter | Nilai |
|---|---|
| Format diterima | `.xlsx`, `.xls` |
| Ukuran maksimum | 10 MB |
| Periode per upload | 1 bulan (tidak boleh overlap tanpa konfirmasi) |

---

## 8. Business Rules

1. **Satu periode = satu payroll run**: tidak boleh ada dua payroll FINAL untuk karyawan yang sama di bulan yang sama.
2. **Gaji pokok tidak boleh 0**: sistem menolak simpan karyawan aktif tanpa struktur gaji.
3. **Nama fingerprint unik**: `nama_fingerprint` tidak boleh duplikat karena digunakan sebagai kunci matching.
4. **Payroll FINAL tidak bisa diedit**: untuk mengubah, harus buat adjustment payroll terpisah.
5. **Hak akses**: HRD bisa proses hingga `PENDING_APPROVAL`. Finance harus approve untuk menjadi `APPROVED`. Super Admin bisa override semua status.
6. **Hari kerja**: sistem menghitung hari hadir berdasarkan data presensi aktual, bukan kalender kerja global — mengakomodasi jadwal shift yang berbeda-beda per karyawan.
7. **Aturan potongan & lembur bersifat opt-in**: default selalu **off**. HRD/Admin harus secara eksplisit mengaktifkan aturan. Override per-karyawan mendahului aturan global.
8. **Snapshot aturan**: nilai aturan yang digunakan saat menghitung gaji disimpan bersama record payroll. Perubahan konfigurasi di kemudian hari tidak mengubah hitungan yang sudah FINAL.

---

## 9. Pertanyaan Terbuka untuk Diskusi

1. Hari libur nasional: apakah sistem perlu kalender hari libur untuk menentukan hari kerja, atau cukup bergantung pada jadwal shift?
2. Untuk driver: apakah km perjalanan dicatat per trip atau direkap total per bulan oleh HRD?
3. Karyawan freelance: apakah diperlakukan sama seperti karyawan tetap dalam sistem, atau ada flow terpisah?
4. Apakah slip gaji perlu tanda tangan digital yang legally binding?
5. Apakah ada kebutuhan rekap gaji per jabatan (bukan hanya per departemen)?

---

*Dokumen ini adalah PRD level fitur. ERD (Entity Relationship Diagram) dan TRD (Table Reference Document) akan dibuat sebagai dokumen terpisah.*
