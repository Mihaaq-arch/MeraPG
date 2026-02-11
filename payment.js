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
// HELPER — Generate nomor nota unik
// ============================================================
async function generateNoNota() {
  const today = new Date();
  const prefix = `NB${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;

  // Cari nomor terakhir hari ini
  const [rows] = await db.execute(
    `SELECT no_nota FROM billing_payment WHERE no_nota LIKE ? ORDER BY no_nota DESC LIMIT 1`,
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

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const no_nota = await generateNoNota();
    const total_bayar = items.reduce((sum, i) => sum + Number(i.total), 0);

    // Insert header pembayaran
    await connection.execute(
      `INSERT INTO billing_payment (no_nota, no_rawat, tgl_bayar, id_user_kasir, total_bayar, keterangan)
       VALUES (?, ?, NOW(), ?, ?, ?)`,
      [no_nota, no_rawat, id_user_kasir, total_bayar, keterangan || null]
    );

    // Insert detail item yang dibayar
    for (const item of items) {
      await connection.execute(
        `INSERT INTO billing_payment_detail (no_nota, nama_item, status, jenis, jumlah, biaya, total)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [no_nota, item.nama_item, item.status, item.jenis, item.jumlah, item.biaya, item.total]
      );
    }

    await connection.commit();

    res.status(201).json({
      message: "Pembayaran berhasil disimpan",
      no_nota,
      no_rawat,
      total_bayar,
      jumlah_item: items.length
    });

  } catch (error) {
    await connection.rollback();
    console.error("Error simpan pembayaran:", error);
    res.status(500).json({ error: "Gagal menyimpan pembayaran", message: error.message });
  } finally {
    connection.release();
  }
});

/**
 * GET /payment/riwayat/:no_rawat
 *
 * Lihat semua riwayat pembayaran untuk 1 no_rawat
 */
router.get("/riwayat/:no_rawat", async (req, res) => {
  const { no_rawat } = req.params;

  try {
    // Ambil semua nota untuk no_rawat ini
    const [payments] = await db.execute(
      `SELECT no_nota, tgl_bayar, id_user_kasir, total_bayar, keterangan
       FROM billing_payment
       WHERE no_rawat = ?
       ORDER BY tgl_bayar DESC`,
      [no_rawat]
    );

    // Untuk setiap nota, ambil detailnya
    const result = [];
    for (const payment of payments) {
      const [details] = await db.execute(
        `SELECT nama_item, status, jenis, jumlah, biaya, total
         FROM billing_payment_detail
         WHERE no_nota = ?`,
        [payment.no_nota]
      );
      result.push({ ...payment, items: details });
    }

    const total_sudah_dibayar = payments.reduce((sum, p) => sum + Number(p.total_bayar), 0);

    res.json({
      no_rawat,
      total_sudah_dibayar,
      jumlah_transaksi: payments.length,
      riwayat: result
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
 * Menggabungkan data billing (dari query app.js) dengan data pembayaran.
 */
router.get("/status/:no_rawat", async (req, res) => {
  const { no_rawat } = req.params;

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
      _lookup: paidMap // Frontend bisa pakai ini untuk centang/uncentang
    });

  } catch (error) {
    console.error("Error ambil status:", error);
    res.status(500).json({ error: "Gagal mengambil status pembayaran", message: error.message });
  }
});

export default router;
