import { Router } from "express";
import { dbNew as db } from "./db.js";

const router = Router();

// ============================================================
// SQL — TABEL PEMBAYARAN
// ============================================================

// Jalankan ini SEKALI di MySQL untuk membuat tabel:
//
// CREATE TABLE IF NOT EXISTS billing_payment (
//   id INT AUTO_INCREMENT PRIMARY KEY,
//   no_nota VARCHAR(20) NOT NULL UNIQUE,
//   no_rawat VARCHAR(20) NOT NULL,
//   tgl_bayar DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
//   id_user_kasir VARCHAR(20) NOT NULL,
//   total_bayar DOUBLE NOT NULL DEFAULT 0,
//   keterangan TEXT,
//   INDEX idx_no_rawat (no_rawat),
//   INDEX idx_tgl_bayar (tgl_bayar)
// ) ENGINE=InnoDB;
//
// CREATE TABLE IF NOT EXISTS billing_payment_detail (
//   id INT AUTO_INCREMENT PRIMARY KEY,
//   no_nota VARCHAR(20) NOT NULL,
//   nama_item VARCHAR(200) NOT NULL,
//   status VARCHAR(30) NOT NULL COMMENT 'Registrasi/Akomodasi/Ralan/Ranap/Retur',
//   jenis VARCHAR(100) NOT NULL,
//   jumlah DOUBLE NOT NULL DEFAULT 1,
//   biaya DOUBLE NOT NULL DEFAULT 0,
//   total DOUBLE NOT NULL DEFAULT 0,
//   FOREIGN KEY (no_nota) REFERENCES billing_payment(no_nota)
// ) ENGINE=InnoDB;

// ============================================================
// HELPER — Generate nomor nota unik (menggunakan connection)
// ============================================================

/**
 * Generate no_nota menggunakan connection yang SAMA dengan transaction.
 * Pakai SELECT ... FOR UPDATE untuk lock row dan hindari race condition.
 * Jika terjadi duplicate, retry sampai MAX_RETRY kali.
 */
const MAX_RETRY = 3;

async function generateNoNota(connection) {
  const today = new Date();
  const prefix = `NB${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;

  // SELECT ... FOR UPDATE → lock baris terakhir agar kasir lain menunggu
  const [rows] = await connection.execute(
    `SELECT no_nota FROM billing_payment WHERE no_nota LIKE ? ORDER BY no_nota DESC LIMIT 1 FOR UPDATE`,
    [`${prefix}%`]
  );

  let seq = 1;
  if (rows.length > 0) {
    const lastSeq = parseInt(rows[0].no_nota.slice(prefix.length));
    seq = lastSeq + 1;
  }

  return `${prefix}${String(seq).padStart(4, "0")}`;
}

// ============================================================
// HELPER — Cek item yang sudah pernah dibayar
// ============================================================

/**
 * Cek apakah ada item yang sudah pernah dibayar (duplikat).
 * Return array nama item yang sudah lunas.
 */
async function checkDuplicatePayment(connection, no_rawat, items) {
  // Ambil semua item yang sudah dibayar untuk no_rawat ini
  const [paidRows] = await connection.execute(
    `SELECT d.nama_item, d.status, d.jenis, SUM(d.total) as total_dibayar
     FROM billing_payment_detail d
     JOIN billing_payment p ON d.no_nota = p.no_nota
     WHERE p.no_rawat = ?
     GROUP BY d.nama_item, d.status, d.jenis`,
    [no_rawat]
  );

  const paidMap = {};
  for (const r of paidRows) {
    const key = `${r.nama_item}|${r.status}|${r.jenis}`;
    paidMap[key] = Number(r.total_dibayar);
  }

  // Cek setiap item yang mau dibayar
  const duplicates = [];
  for (const item of items) {
    const key = `${item.nama_item}|${item.status}|${item.jenis}`;
    if (paidMap[key] && paidMap[key] >= Number(item.total)) {
      duplicates.push(item.nama_item);
    }
  }

  return duplicates;
}

// ============================================================
// ROUTES
// ============================================================

/**
 * POST /payment/bayar
 *
 * Body (JSON):
 * {
 *   "no_rawat": "2024/01/15/000001",
 *   "id_user_kasir": "admin",
 *   "keterangan": "Bayar registrasi",
 *   "items": [
 *     { "nama_item": "Registrasi", "status": "Registrasi", "jenis": "BPJS", "jumlah": 1, "biaya": 25000, "total": 25000 },
 *     { "nama_item": "Paracetamol", "status": "Ranap", "jenis": "OBAT & BHP", "jumlah": 3, "biaya": 5000, "total": 15000 }
 *   ]
 * }
 */
router.post("/bayar", async (req, res) => {
  const { no_rawat, id_user_kasir, keterangan, items } = req.body;

  // Validasi input
  if (!no_rawat || !id_user_kasir || !items || items.length === 0) {
    return res.status(400).json({
      error: "Field wajib: no_rawat, id_user_kasir, items (min 1 item)"
    });
  }

  // Validasi setiap item
  for (const item of items) {
    if (!item.nama_item || !item.status || !item.jenis || item.total == null) {
      return res.status(400).json({
        error: "Setiap item harus punya: nama_item, status, jenis, total"
      });
    }
  }

  let attempt = 0;
  while (attempt < MAX_RETRY) {
    attempt++;
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      // Cek duplikat pembayaran
      const duplicates = await checkDuplicatePayment(connection, no_rawat, items);
      if (duplicates.length > 0) {
        await connection.rollback();
        return res.status(409).json({
          error: "Item sudah pernah dibayar",
          duplicates
        });
      }

      // Generate no_nota di DALAM transaction (dengan FOR UPDATE lock)
      const no_nota = await generateNoNota(connection);
      const total_bayar = items.reduce((sum, i) => sum + Number(i.total), 0);

      // Insert header pembayaran
      await connection.execute(
        `INSERT INTO billing_payment (no_nota, no_rawat, tgl_bayar, id_user_kasir, total_bayar, keterangan)
         VALUES (?, ?, NOW(), ?, ?, ?)`,
        [no_nota, no_rawat, id_user_kasir, total_bayar, keterangan || null]
      );

      // Insert detail item — batch insert lebih efisien
      if (items.length > 0) {
        const placeholders = items.map(() => "(?, ?, ?, ?, ?, ?, ?)").join(", ");
        const values = items.flatMap(item => [
          no_nota, item.nama_item, item.status, item.jenis,
          item.jumlah || 1, item.biaya || 0, item.total
        ]);
        await connection.execute(
          `INSERT INTO billing_payment_detail (no_nota, nama_item, status, jenis, jumlah, biaya, total)
           VALUES ${placeholders}`,
          values
        );
      }

      await connection.commit();

      return res.status(201).json({
        message: "Pembayaran berhasil disimpan",
        no_nota,
        no_rawat,
        total_bayar,
        jumlah_item: items.length
      });

    } catch (error) {
      await connection.rollback();

      // Jika duplicate key (race condition), retry
      if (error.code === "ER_DUP_ENTRY" && attempt < MAX_RETRY) {
        console.warn(`[payment] Retry ${attempt}/${MAX_RETRY} — duplicate no_nota, regenerating...`);
        continue;
      }

      console.error("Error simpan pembayaran:", error);
      return res.status(500).json({ error: "Gagal menyimpan pembayaran", message: error.message });
    } finally {
      connection.release();
    }
  }

  // Jika semua retry gagal
  return res.status(500).json({ error: "Gagal generate nomor nota setelah beberapa percobaan" });
});

/**
 * GET /payment/riwayat/:no_rawat
 *
 * Lihat semua riwayat pembayaran untuk 1 no_rawat.
 * Wildcard route: no_rawat bisa mengandung "/" (contoh: 2025/11/23/010020)
 */
router.get("/riwayat/{*path}", async (req, res) => {
  const no_rawat = req.params.path;

  try {
    // Single query dengan JOIN — menghindari N+1
    const [rows] = await db.execute(
      `SELECT p.no_nota, p.tgl_bayar, p.id_user_kasir, p.total_bayar, p.keterangan,
              d.nama_item, d.status, d.jenis, d.jumlah, d.biaya, d.total
       FROM billing_payment p
       LEFT JOIN billing_payment_detail d ON p.no_nota = d.no_nota
       WHERE p.no_rawat = ?
       ORDER BY p.tgl_bayar DESC, d.id ASC`,
      [no_rawat]
    );

    // Group rows by no_nota
    const paymentMap = new Map();
    for (const row of rows) {
      if (!paymentMap.has(row.no_nota)) {
        paymentMap.set(row.no_nota, {
          no_nota: row.no_nota,
          tgl_bayar: row.tgl_bayar,
          id_user_kasir: row.id_user_kasir,
          total_bayar: row.total_bayar,
          keterangan: row.keterangan,
          items: []
        });
      }
      if (row.nama_item) {
        paymentMap.get(row.no_nota).items.push({
          nama_item: row.nama_item,
          status: row.status,
          jenis: row.jenis,
          jumlah: row.jumlah,
          biaya: row.biaya,
          total: row.total
        });
      }
    }

    const riwayat = [...paymentMap.values()];
    const total_sudah_dibayar = riwayat.reduce((sum, p) => sum + Number(p.total_bayar), 0);

    res.json({
      no_rawat,
      total_sudah_dibayar,
      jumlah_transaksi: riwayat.length,
      riwayat
    });

  } catch (error) {
    console.error("Error ambil riwayat:", error);
    res.status(500).json({ error: "Gagal mengambil riwayat pembayaran", message: error.message });
  }
});

/**
 * GET /payment/status/:no_rawat
 *
 * Lihat item mana yang sudah dibayar dan mana yang belum.
 * Wildcard route: no_rawat bisa mengandung "/"
 */
router.get("/status/{*path}", async (req, res) => {
  const no_rawat = req.params.path;

  try {
    // Ambil semua item yang sudah pernah dibayar
    const [paidItems] = await db.execute(
      `SELECT d.nama_item, d.status, d.jenis, SUM(d.total) as total_dibayar
       FROM billing_payment_detail d
       JOIN billing_payment p ON d.no_nota = p.no_nota
       WHERE p.no_rawat = ?
       GROUP BY d.nama_item, d.status, d.jenis`,
      [no_rawat]
    );

    // Buat lookup map: "nama_item|status|jenis" -> total_dibayar
    const paidMap = {};
    for (const item of paidItems) {
      const key = `${item.nama_item}|${item.status}|${item.jenis}`;
      paidMap[key] = Number(item.total_dibayar);
    }

    const total_sudah_dibayar = paidItems.reduce((sum, i) => sum + Number(i.total_dibayar), 0);

    res.json({
      no_rawat,
      total_sudah_dibayar,
      paid_items: paidItems,
      _lookup: paidMap
    });

  } catch (error) {
    console.error("Error ambil status:", error);
    res.status(500).json({ error: "Gagal mengambil status pembayaran", message: error.message });
  }
});

export default router;
