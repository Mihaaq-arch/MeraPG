# MeraPG Billing API

> **Blueprint / Prototype** — Node.js prototype untuk logika billing SIMRS.
> Akan diintegrasikan ke sistem utuh menggunakan **Go + React**.

API server untuk mengambil dan menampilkan data billing pasien dari database SIMRS (Sistem Informasi Manajemen Rumah Sakit).

## Fitur

- 📊 **Aggregasi data billing** dari berbagai sumber (tindakan, obat, radiologi, laboratorium)
- 🏥 **Mendukung rawat inap (Ranap) dan rawat jalan (Ralan)**
- 📄 **Dual output**: HTML (untuk browser) dan JSON (untuk API)
- 🔄 **Grouping otomatis** berdasarkan status dan jenis layanan

## Persyaratan

- Node.js v18+
- MySQL/MariaDB
- Database SIMRS dengan struktur tabel yang sesuai

## Instalasi

```bash
# Clone repository
git clone https://github.com/Mihaaq/MeraPG.git
cd MeraPG

# Install dependencies
npm install

# Konfigurasi environment
cp .env.example .env
# Edit .env sesuai konfigurasi database Anda
```

## Konfigurasi

Buat file `.env` dengan isi:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=sik
```

## Menjalankan Server

```bash
# Production
npm start

# Development (dengan auto-reload)
npm run dev

# Atau langsung
node app.js
```

Server akan berjalan di `http://localhost:3000`

## API Endpoints

### 1. GET `/billing`

Mengambil data billing dengan query parameter.

**Request:**
```
GET /billing?no_rawat=2024/01/15/000001
```

**Response (Browser/HTML):**
Menampilkan halaman HTML dengan data billing yang dikelompokkan dan collapsible.

**Response (API/JSON):**
```json
{
  "no_rawat": "2024/01/15/000001",
  "items": [...],
  "grand_total": 1500000
}
```

### 2. GET `/billing/:no_rawat`

Mengambil data billing dengan path parameter (khusus JSON).

**Request:**
```
GET /billing/2024/01/15/000001
```

**Response:**
```json
{
  "no_rawat": "2024/01/15/000001",
  "groups": [
    {
      "status": "Ranap",
      "items": [...],
      "subtotal": 1000000
    },
    {
      "status": "Ralan",
      "items": [...],
      "subtotal": 500000
    }
  ],
  "grand_total": 1500000
}
```

## Sumber Data

Data billing diambil dari tabel-tabel berikut:

| Kategori | Tabel | Deskripsi |
|----------|-------|-----------|
| Registrasi | `reg_periksa`, `penjab` | Biaya registrasi + info penjamin |
| Akomodasi | `kamar_inap`, `kamar`, `bangsal` | Biaya kamar rawat inap |
| Tindakan Ralan | `rawat_jl_pr`, `rawat_jl_dr`, `rawat_jl_drpr` | Tindakan rawat jalan (UNION ALL) |
| Tindakan Ranap | `rawat_inap_pr`, `rawat_inap_dr`, `rawat_inap_drpr` | Tindakan rawat inap (UNION ALL) |
| Obat & BHP | `detail_pemberian_obat` | Pemberian obat dan bahan habis pakai |
| Radiologi | `periksa_radiologi` | Pemeriksaan radiologi |
| Laboratorium | `periksa_lab` | Pemeriksaan laboratorium |
| Operasi | `operasi`, `paket_operasi` | Biaya operasi (semua komponen) |
| Retur Obat | `detreturjual`, `returjual` | Pengembalian obat (pengurang) |

## Struktur Response Item

Setiap item billing memiliki struktur:

```json
{
  "nama_brng": "Nama tindakan/obat",
  "biaya_obat": 50000,
  "jml": 2,
  "embalase": 0,
  "tuslah": 0,
  "total": 100000,
  "status": "Ranap|Ralan",
  "jenis": "Kategori layanan"
}
```

## Arsitektur

```
app.js
├── DATABASE           — MySQL connection pool
├── CONSTANTS          — STATUS_ORDER (urutan tampilan)
├── SQL QUERIES        — 9 query (ranap & ralan sudah UNION ALL)
├── QUERY REGISTRY     — BILLING_QUERIES[] (tambah query baru cukup 1 entry)
├── HELPER FUNCTIONS
│   ├── fetchBillingItems(no_rawat)    — eksekusi paralel semua query
│   ├── groupByStatus(items)           — grouping Status → Jenis
│   ├── getOrderedStatuses(grouped)    — urutkan & filter status kosong
│   └── renderBillingHtml(...)         — render template HTML
├── ROUTES
│   ├── GET /billing         — HTML (browser) + JSON (API)
│   └── GET /billing/:no_rawat — JSON grouped by status
└── START SERVER       — port 3000
```

### Urutan Status Billing

Status ditampilkan dalam urutan tetap. Status tanpa data otomatis disembunyikan:

1. **Registrasi** → 2. **Akomodasi** → 3. **Ralan** → 4. **Ranap** → 5. **Retur**

## Contoh Penggunaan

### Via Browser
Buka: `http://localhost:3000/billing?no_rawat=2024/01/15/000001`

### Via cURL
```bash
# JSON response
curl -H "Accept: application/json" \
  "http://localhost:3000/billing?no_rawat=2024/01/15/000001"

# HTML response
curl "http://localhost:3000/billing?no_rawat=2024/01/15/000001"
```

### Via JavaScript/Fetch
```javascript
const response = await fetch('/billing?no_rawat=2024/01/15/000001', {
  headers: { 'Accept': 'application/json' }
});
const data = await response.json();
console.log(data.grand_total);
```

## Changelog

### 2026-02-10
- ✅ Tambah billing registrasi, akomodasi (kamar), operasi, dan retur obat
- ✅ Urutan status dikunci: Registrasi → Akomodasi → Ralan → Ranap → Retur
- ✅ Status tanpa tagihan otomatis disembunyikan
- ✅ Konsolidasi 6 query tindakan menjadi 2 query UNION ALL (13 → 9 round-trip)
- ✅ Refactor ke arsitektur modular: helper functions + query registry
- ✅ Endpoint `/billing/:no_rawat` diubah ke eksekusi paralel (Promise.all)

## TODO / Pengembangan Selanjutnya (untuk integrasi Go + React)

- [ ] Port logika query ke Go (SQL tetap sama)
- [ ] Buat React frontend untuk kasir
- [ ] Cari pasien (by nama, no_RM, no_rawat)
- [ ] Info pasien di header billing
- [ ] Proses pembayaran (input bayar, metode, kembalian)
- [ ] Print struk/kwitansi
- [ ] Autentikasi dan otorisasi kasir
- [ ] Audit trail transaksi
- [ ] Laporan harian kasir

## Lisensi

ISC
