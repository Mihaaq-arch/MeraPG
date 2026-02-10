# MeraPG Billing API

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
| Tindakan Ranap | `rawat_inap_pr`, `rawat_inap_dr`, `rawat_inap_drpr` | Tindakan petugas, dokter, dan gabungan |
| Tindakan Ralan | `rawat_jl_pr`, `rawat_jl_dr`, `rawat_jl_drpr` | Tindakan rawat jalan |
| Obat & BHP | `detail_pemberian_obat` | Pemberian obat dan bahan habis pakai |
| Radiologi | `periksa_radiologi` | Pemeriksaan radiologi |
| Laboratorium | `periksa_lab` | Pemeriksaan laboratorium |

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
├── Express Server (port 3000)
├── MySQL Connection Pool
├── SQL Queries (9 query paralel)
├── Data Aggregation & Grouping
└── Response Formatters (HTML/JSON)
```

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

## TODO / Pengembangan Selanjutnya

- [ ] Autentikasi dan otorisasi
- [ ] Validasi format `no_rawat`
- [ ] Caching untuk query yang sering diakses
- [ ] Logging request/response
- [ ] Unit testing
- [ ] Endpoint untuk listing pasien

## Lisensi

ISC
