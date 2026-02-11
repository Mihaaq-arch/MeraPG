# MeraPG Billing & Payment Gateway

> **Blueprint / Prototype** — Node.js prototype untuk logika billing & pembayaran SIMRS.
> Akan diintegrasikan ke sistem utuh menggunakan **Go + React**.

Billing & Payment gateway untuk SIMRS dengan arsitektur **dual-database**: membaca data tagihan dari database lama (read-only) dan menyimpan data pembayaran ke database baru.

## Fitur

- 📊 **Aggregasi data billing** dari berbagai sumber (tindakan, obat, radiologi, laboratorium, operasi)
- 🏥 **Mendukung rawat inap (Ranap) dan rawat jalan (Ralan)**
- 💰 **Pembayaran kasir** dengan UI interaktif langsung di halaman billing
- 🔄 **Dual database** — `rsaz_sik` (read) + `mera_db` (write)
- ✅ **Integrasi SIMRS lama** — mengenali pembayaran dari `tagihan_sadewa`
- 📄 **Dual output**: HTML (untuk browser) dan JSON (untuk API)

## Arsitektur Database

```
┌─────────────┐     ┌──────────────────┐
│   MeraPG    │────▶│ dbLegacy (pool)  │──▶ rsaz_sik (READ-ONLY)
│   app.js    │     │ - billing data   │    - reg_periksa, rawat_*, dll
│             │     │ - tagihan_sadewa │    - tagihan_sadewa
│             │     └──────────────────┘
│             │     ┌──────────────────┐
│ payment.js  │────▶│ dbNew (pool)     │──▶ mera_db (READ+WRITE)
│             │     │ - billing_payment│    - billing_payment
│             │     │ - payment_detail │    - billing_payment_detail
└─────────────┘     └──────────────────┘
```

## Persyaratan

- Node.js v18+
- MySQL/MariaDB
- Database SIMRS (`rsaz_sik`) dengan struktur tabel yang sesuai
- Database baru (`mera_db`) untuk data pembayaran

## Instalasi

```bash
git clone https://github.com/Mihaaq/MeraPG.git
cd MeraPG
npm install
```

## Konfigurasi

Buat file `.env`:

```env
# Database lama (READ-ONLY)
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=rsaz_sik

# Database baru (READ+WRITE)
DB_NEW_HOST=localhost
DB_NEW_PORT=3306
DB_NEW_USER=root
DB_NEW_PASSWORD=your_password
DB_NEW_NAME=mera_db
```

### Setup Database Baru

```sql
CREATE DATABASE mera_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE mera_db;

CREATE TABLE billing_payment (
  id INT AUTO_INCREMENT PRIMARY KEY,
  no_nota VARCHAR(20) NOT NULL UNIQUE,
  no_rawat VARCHAR(20) NOT NULL,
  tgl_bayar DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  id_user_kasir VARCHAR(20) NOT NULL,
  total_bayar DOUBLE NOT NULL DEFAULT 0,
  keterangan TEXT,
  INDEX idx_no_rawat (no_rawat),
  INDEX idx_tgl_bayar (tgl_bayar)
) ENGINE=InnoDB;

CREATE TABLE billing_payment_detail (
  id INT AUTO_INCREMENT PRIMARY KEY,
  no_nota VARCHAR(20) NOT NULL,
  nama_item VARCHAR(200) NOT NULL,
  status VARCHAR(30) NOT NULL COMMENT 'Registrasi/Akomodasi/Ralan/Ranap/Retur',
  jenis VARCHAR(100) NOT NULL,
  jumlah DOUBLE NOT NULL DEFAULT 1,
  biaya DOUBLE NOT NULL DEFAULT 0,
  total DOUBLE NOT NULL DEFAULT 0,
  FOREIGN KEY (no_nota) REFERENCES billing_payment(no_nota)
) ENGINE=InnoDB;
```

## Menjalankan Server

```bash
npm run dev     # Development (auto-reload)
npm start       # Production
```

Server berjalan di `http://localhost:3000`

## API Endpoints

### Halaman

| Method | Path | Deskripsi |
|--------|------|-----------|
| GET | `/` | Home page — input no_rawat + navigasi |
| GET | `/billing?no_rawat=...` | Halaman billing + pembayaran kasir (HTML/JSON) |

### Billing API

| Method | Path | Deskripsi |
|--------|------|-----------|
| GET | `/billing?no_rawat=...` | Billing items + grand total (HTML/JSON) |
| GET | `/billing/:no_rawat` | Billing grouped by status (JSON only) |

### Payment API

| Method | Path | Deskripsi |
|--------|------|-----------|
| POST | `/payment/bayar` | Simpan pembayaran (dari UI atau API) |
| GET | `/payment/status/:no_rawat` | Cek item mana yang sudah/belum dibayar |
| GET | `/payment/riwayat/:no_rawat` | Riwayat semua transaksi pembayaran |

### Contoh POST `/payment/bayar`

```json
{
  "no_rawat": "2024/01/15/000001",
  "id_user_kasir": "admin",
  "items": [
    { "nama_item": "Registrasi", "status": "Registrasi", "jenis": "BPJS", "jumlah": 1, "biaya": 25000, "total": 25000 }
  ]
}
```

## Sumber Data Billing

| Kategori | Tabel (rsaz_sik) | Deskripsi |
|----------|-------------------|-----------|
| Registrasi | `reg_periksa`, `penjab` | Biaya registrasi + info penjamin |
| Akomodasi | `kamar_inap`, `kamar`, `bangsal` | Biaya kamar rawat inap |
| Tindakan Ralan | `rawat_jl_pr`, `rawat_jl_dr`, `rawat_jl_drpr` | Tindakan rawat jalan |
| Tindakan Ranap | `rawat_inap_pr`, `rawat_inap_dr`, `rawat_inap_drpr` | Tindakan rawat inap |
| Obat & BHP | `detail_pemberian_obat` | Obat dan bahan habis pakai |
| Radiologi | `periksa_radiologi` | Pemeriksaan radiologi |
| Laboratorium | `periksa_lab` | Pemeriksaan laboratorium |
| Operasi | `operasi`, `paket_operasi` | Biaya operasi |
| Retur Obat | `detreturjual`, `returjual` | Pengembalian obat (pengurang) |
| **Pembayaran lama** | `tagihan_sadewa` | Pembayaran via SIMRS (read-only) |

## Struktur File

```
MeraPG/
├── app.js        — Server utama, billing queries, UI billing+payment
├── payment.js    — Routes pembayaran (CRUD ke mera_db)
├── db.js         — Dual database pool (dbLegacy + dbNew)
├── .env          — Konfigurasi kedua database
└── package.json
```

## Changelog

### 2026-02-11
- ✅ Arsitektur dual-database: `rsaz_sik` (read-only) + `mera_db` (read+write)
- ✅ Home page di `/` dengan form no_rawat dan navigasi
- ✅ UI pembayaran kasir di halaman billing (checkbox, pilih semua, tombol bayar)
- ✅ Summary bar: Total Tagihan / Sudah Dibayar / Sisa
- ✅ Badge LUNAS/BELUM per item billing
- ✅ Integrasi `tagihan_sadewa` — pembayaran lama dikenali dengan badge `LUNAS (SIMRS)`
- ✅ Item dengan tagihan Rp 0 otomatis disembunyikan
- ✅ Floating payment bar dengan input ID kasir
- ✅ Payment route (`payment.js`) dialihkan ke `mera_db`

### 2026-02-10
- ✅ Tambah billing registrasi, akomodasi (kamar), operasi, dan retur obat
- ✅ Urutan status dikunci: Registrasi → Akomodasi → Ralan → Ranap → Retur
- ✅ Konsolidasi query tindakan menjadi UNION ALL
- ✅ Refactor ke arsitektur modular: helper functions + query registry

## TODO

- [ ] Port ke Go + React
- [ ] Cari pasien (by nama, no_RM, no_rawat)
- [ ] Info pasien di header billing
- [ ] Jenis pembayaran (Pelunasan/Deposit/Cicilan/Uang Muka)
- [ ] Pembatalan/void pembayaran
- [ ] Print struk/kwitansi
- [ ] Autentikasi dan otorisasi kasir
- [ ] Audit trail transaksi
- [ ] Laporan harian kasir

## Lisensi

ISC

