import express from "express";
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const app = express();

// 1. Buat koneksi pool di luar (agar bisa dipakai berulang kali)
// Konfigurasi diambil dari file .env
const db = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "sik",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});


const SQL_BILLING_TINDAKAN_RANAP_PETUGAS = `
SELECT
    jpi.nm_perawatan AS nama_brng,
    rip.biaya_rawat AS biaya_obat,
    COUNT(*) AS jml,
    0 AS embalase,
    0 AS tuslah,
    SUM(rip.biaya_rawat) AS total,
    'Ranap' AS status,
    kp.nm_kategori AS jenis
  FROM rawat_inap_pr rip
  JOIN jns_perawatan_inap jpi ON rip.kd_jenis_prw = jpi.kd_jenis_prw
  JOIN kategori_perawatan kp ON jpi.kd_kategori = kp.kd_kategori
  WHERE rip.no_rawat = ?
  GROUP BY
      rip.no_rawat,
      rip.kd_jenis_prw,
      rip.biaya_rawat,
      jpi.nm_perawatan,
      kp.nm_kategori
  ORDER BY status, nama_brng;
`;

const SQL_BILLING_TINDAKAN_RANAP_DOKTER = `
SELECT
    jpi.nm_perawatan AS nama_brng,
    rip.biaya_rawat AS biaya_obat,
    COUNT(*) AS jml,
    0 AS embalase,
    0 AS tuslah,
    SUM(rip.biaya_rawat) AS total,
    'Ranap' AS status,
    kp.nm_kategori AS jenis
  FROM rawat_inap_dr rip
  JOIN jns_perawatan_inap jpi ON rip.kd_jenis_prw = jpi.kd_jenis_prw
  JOIN kategori_perawatan kp ON jpi.kd_kategori = kp.kd_kategori
  WHERE rip.no_rawat = ?
  GROUP BY
      rip.no_rawat,
      rip.kd_jenis_prw,
      rip.biaya_rawat,
      jpi.nm_perawatan,
      kp.nm_kategori
  ORDER BY status, nama_brng;
`;

const SQL_BILLING_TINDAKAN_RANAP_DOKTER_PETUGAS = `
SELECT
    jpi.nm_perawatan AS nama_brng,
    rip.biaya_rawat AS biaya_obat,
    COUNT(*) AS jml,
    0 AS embalase,
    0 AS tuslah,
    SUM(rip.biaya_rawat) AS total,
    'Ranap' AS status,
    kp.nm_kategori AS jenis
  FROM rawat_inap_drpr rip
  JOIN jns_perawatan_inap jpi ON rip.kd_jenis_prw = jpi.kd_jenis_prw
  JOIN kategori_perawatan kp ON jpi.kd_kategori = kp.kd_kategori
  WHERE rip.no_rawat = ?
  GROUP BY
      rip.no_rawat,
      rip.kd_jenis_prw,
      rip.biaya_rawat,
      jpi.nm_perawatan,
      kp.nm_kategori
  ORDER BY status, nama_brng;
`;

const SQL_BILLING_TINDAKAN_RALAN_PETUGAS = `
SELECT
    jpi.nm_perawatan AS nama_brng,
    rip.biaya_rawat AS biaya_obat,
    COUNT(*) AS jml,
    0 AS embalase,
    0 AS tuslah,
    SUM(rip.biaya_rawat) AS total,
    'Ralan' AS status,
    kp.nm_kategori AS jenis
  FROM rawat_jl_pr rip
  JOIN jns_perawatan jpi ON rip.kd_jenis_prw = jpi.kd_jenis_prw
  JOIN kategori_perawatan kp ON jpi.kd_kategori = kp.kd_kategori
  WHERE rip.no_rawat = ?
  GROUP BY
      rip.no_rawat,
      rip.kd_jenis_prw,
      rip.biaya_rawat,
      jpi.nm_perawatan,
      kp.nm_kategori
  ORDER BY status, nama_brng;
`;


const SQL_BILLING_TINDAKAN_RALAN_DOKTER = `
SELECT
    jpi.nm_perawatan AS nama_brng,
    rip.biaya_rawat AS biaya_obat,
    COUNT(*) AS jml,
    0 AS embalase,
    0 AS tuslah,
    SUM(rip.biaya_rawat) AS total,
    'Ralan' AS status,
    kp.nm_kategori AS jenis
  FROM rawat_jl_dr rip
  JOIN jns_perawatan jpi ON rip.kd_jenis_prw = jpi.kd_jenis_prw
  JOIN kategori_perawatan kp ON jpi.kd_kategori = kp.kd_kategori
  WHERE rip.no_rawat = ?
  GROUP BY
      rip.no_rawat,
      rip.kd_jenis_prw,
      rip.biaya_rawat,
      jpi.nm_perawatan,
      kp.nm_kategori
  ORDER BY status, nama_brng;
`;


const SQL_BILLING_TINDAKAN_RALAN_DOKTER_PETUGAS = `
SELECT
    jpi.nm_perawatan AS nama_brng,
    rip.biaya_rawat AS biaya_obat,
    COUNT(*) AS jml,
    0 AS embalase,
    0 AS tuslah,
    SUM(rip.biaya_rawat) AS total,
    'Ralan' AS status,
    kp.nm_kategori AS jenis
  FROM rawat_jl_drpr rip
  JOIN jns_perawatan jpi ON rip.kd_jenis_prw = jpi.kd_jenis_prw
  JOIN kategori_perawatan kp ON jpi.kd_kategori = kp.kd_kategori
  WHERE rip.no_rawat = ?
  GROUP BY
      rip.no_rawat,
      rip.kd_jenis_prw,
      rip.biaya_rawat,
      jpi.nm_perawatan,
      kp.nm_kategori
  ORDER BY status, nama_brng;
`;

const SQL_BILLING_OBAT = `
SELECT
    db.nama_brng,
    dpo.biaya_obat,
    dpo.jml,
    dpo.embalase,
    dpo.tuslah,
    dpo.total,
    dpo.status,
    "OBAT & BHP" as jenis
  FROM detail_pemberian_obat dpo
  JOIN databarang db ON dpo.kode_brng = db.kode_brng
  JOIN jenis j ON db.kdjns = j.kdjns
  WHERE dpo.no_rawat = ?
  ORDER BY dpo.status, j.nama
`;

const SQL_BILLING_RADIOLOGI = `
SELECT
    jpr.nm_perawatan as nama_brng,
    pr.biaya as biaya_obat,
    1 as jml,
    0 as embalase,
    0 as tuslah,
    pr.biaya as total,
    pr.status,
    "RADIOLOGI" as jenis
  FROM periksa_radiologi pr
  JOIN jns_perawatan_radiologi jpr ON pr.kd_jenis_prw = jpr.kd_jenis_prw
  WHERE pr.no_rawat = ?
  ORDER BY pr.status, jpr.nm_perawatan
`;

const SQL_BILLING_LABORATORIUM = `
SELECT
    jpr.nm_perawatan as nama_brng,
    pr.biaya as biaya_obat,
    1 as jml,
    0 as embalase,
    0 as tuslah,
    pr.biaya as total,
    pr.status,
		CONCAT("LABORATORIUM ",pr.kategori) AS jenis
  FROM periksa_lab pr
  JOIN jns_perawatan_lab jpr ON pr.kd_jenis_prw = jpr.kd_jenis_prw
  WHERE pr.no_rawat = ? 
  ORDER BY pr.status, jpr.nm_perawatan
`;

app.get("/billing", async (req, res) => {
  const { no_rawat } = req.query;

  if (!no_rawat) {
    return res.status(400).send("no_rawat wajib disertakan (contoh: ?no_rawat=2022/02/02/000002)");
  }

  try {
    // 3. EKSEKUSI PARALEL (Tips: Promise.all biar cepat)
    // PENTING: Destructure 8 variabel untuk 8 query!
    const [
      rowsTindakanRanapPetugas,
      rowsTindakanRanapDokter,
      rowsTindakanRanapDokterPetugas,
      rowsTindakanRalanPetugas,
      rowsTindakanRalanDokter,
      rowsTindakanRalanDokterPetugas,
      rowsObat,
      rowsRadiologi,
      rowsLaboratorium
    ] = await Promise.all([
      db.execute(SQL_BILLING_TINDAKAN_RANAP_PETUGAS, [no_rawat]),
      db.execute(SQL_BILLING_TINDAKAN_RANAP_DOKTER, [no_rawat]),
      db.execute(SQL_BILLING_TINDAKAN_RANAP_DOKTER_PETUGAS, [no_rawat]),
      db.execute(SQL_BILLING_TINDAKAN_RALAN_PETUGAS, [no_rawat]),
      db.execute(SQL_BILLING_TINDAKAN_RALAN_DOKTER, [no_rawat]),
      db.execute(SQL_BILLING_TINDAKAN_RALAN_DOKTER_PETUGAS, [no_rawat]),
      db.execute(SQL_BILLING_OBAT, [no_rawat]),
      db.execute(SQL_BILLING_RADIOLOGI, [no_rawat]),
      db.execute(SQL_BILLING_LABORATORIUM, [no_rawat])
    ]); 

    // Ambil hasil rows saja (index ke-0 dari return value execute)
    const itemsTindakanRanapPetugas = rowsTindakanRanapPetugas[0];
    const itemsTindakanRanapDokter = rowsTindakanRanapDokter[0];
    const itemsTindakanRanapDokterPetugas = rowsTindakanRanapDokterPetugas[0];
    const itemsTindakanRalanPetugas = rowsTindakanRalanPetugas[0];
    const itemsTindakanRalanDokter = rowsTindakanRalanDokter[0];
    const itemsTindakanRalanDokterPetugas = rowsTindakanRalanDokterPetugas[0];
    const itemsObat = rowsObat[0];
    const itemsRadiologi = rowsRadiologi[0];
    const itemsLaboratorium = rowsLaboratorium[0];

    // 4. GABUNGKAN HASIL (Javascript Join)
    const allItems = [...itemsTindakanRanapPetugas, ...itemsTindakanRanapDokter, ...itemsTindakanRanapDokterPetugas, ...itemsTindakanRalanPetugas, ...itemsTindakanRalanDokter, ...itemsTindakanRalanDokterPetugas, ...itemsObat, ...itemsRadiologi, ...itemsLaboratorium];

    const grand_total = allItems.reduce(
      (sum, r) => sum + Number(r.total),
      0
    );

    const response = {
      no_rawat,
      items: allItems,
      grand_total
    };

    // ====== GROUPING: Status -> Jenis ======
    const grouped = {};
    for (const item of allItems) {
      const statusKey = item.status || "Lainnya";
      const jenisKey = item.jenis || "Lainnya";
      if (!grouped[statusKey]) grouped[statusKey] = {};
      if (!grouped[statusKey][jenisKey]) grouped[statusKey][jenisKey] = { items: [], subtotal: 0 };
      grouped[statusKey][jenisKey].items.push(item);
      grouped[statusKey][jenisKey].subtotal += Number(item.total);
    }

    // ====== TAMPILAN UNTUK MANUSIA (Browser) ======
    if (req.headers.accept?.includes("text/html")) {
      // Build collapsible HTML
      let htmlContent = "";
      for (const [status, jenisMap] of Object.entries(grouped)) {
        let statusSubtotal = 0;
        let jenisHtml = "";
        for (const [jenis, data] of Object.entries(jenisMap)) {
          statusSubtotal += data.subtotal;
          jenisHtml += `
            <details style="margin-left: 20px; margin-bottom: 8px;">
              <summary style="cursor: pointer; padding: 8px; background: #e9e9e9; border-radius: 4px;">
                <strong>${jenis}</strong> — Subtotal: <span style="color: green; font-weight: bold;">Rp ${data.subtotal.toLocaleString()}</span> (${data.items.length} item)
              </summary>
              <table style="width: 100%; margin-top: 8px; border-collapse: collapse; font-size: 14px;">
                <thead>
                  <tr style="background: #f5f5f5;">
                    <th style="border: 1px solid #ccc; padding: 6px;">Nama</th>
                    <th style="border: 1px solid #ccc; padding: 6px; text-align: right;">Biaya</th>
                    <th style="border: 1px solid #ccc; padding: 6px; text-align: center;">Jml</th>
                    <th style="border: 1px solid #ccc; padding: 6px; text-align: right;">Tambahan</th>
                    <th style="border: 1px solid #ccc; padding: 6px; text-align: right;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${data.items.map(r => `
                    <tr>
                      <td style="border: 1px solid #ccc; padding: 6px;">${r.nama_brng}</td>
                      <td style="border: 1px solid #ccc; padding: 6px; text-align: right;">${Number(r.biaya_obat).toLocaleString()}</td>
                      <td style="border: 1px solid #ccc; padding: 6px; text-align: center;">${r.jml}</td>
                      <td style="border: 1px solid #ccc; padding: 6px; text-align: right;">${r.embalase+r.tuslah}</td>
                      <td style="border: 1px solid #ccc; padding: 6px; text-align: right;">${Number(r.total).toLocaleString()}</td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </details>
          `;
        }
        htmlContent += `
          <details style="margin-bottom: 12px; border: 1px solid #ccc; border-radius: 6px; padding: 10px;">
            <summary style="cursor: pointer; font-size: 18px; font-weight: bold; padding: 8px; background: #d0e8ff; border-radius: 4px;">
              Status: ${status} — Total: <span style="color: blue;">Rp ${statusSubtotal.toLocaleString()}</span>
            </summary>
            <div style="margin-top: 10px;">
              ${jenisHtml}
            </div>
          </details>
        `;
      }

      return res.send(`
        <html>
        <head>
          <title>Billing: ${no_rawat}</title>
          <style>
            body { font-family: 'Segoe UI', sans-serif; padding: 20px; background: #f9f9f9; }
            h2 { color: #333; }
            .grand-total { font-size: 22px; margin-top: 20px; padding: 15px; background: #333; color: #fff; border-radius: 6px; }
          </style>
        </head>
        <body>
          <h2>Billing: ${no_rawat}</h2>
          ${htmlContent}
          <div class="grand-total">
            Grand Total: Rp ${grand_total.toLocaleString()}
          </div>
          <hr/>
          <details>
            <summary>Lihat JSON Response</summary>
            <pre>${JSON.stringify(response, null, 2)}</pre>
          </details>
        </body>
        </html>
      `);
    }

    // ====== RESPONSE API (JSON) ======
    res.json(response);
    
  } catch (error) {
    console.error(error);
    res.status(500).send("Terjadi kesalahan pada server: " + error.message);
  }
});

app.get("/billing/:no_rawat", async (req, res) => {
  const { no_rawat } = req.params;

  try {
     // Gunakan teknik yang sama untuk endpoint ini (Parallel + Combine)
    const [rowsTindakanRanapPetugas] = await db.execute(SQL_BILLING_TINDAKAN_RANAP_PETUGAS, [no_rawat]);
    const [rowsTindakanRanapDokter] = await db.execute(SQL_BILLING_TINDAKAN_RANAP_DOKTER, [no_rawat]);
    const [rowsTindakanRanapDokterPetugas] = await db.execute(SQL_BILLING_TINDAKAN_RANAP_DOKTER_PETUGAS, [no_rawat]);
    const [rowsTindakanRalanPetugas] = await db.execute(SQL_BILLING_TINDAKAN_RALAN_PETUGAS, [no_rawat]);
    const [rowsTindakanRalanDokter] = await db.execute(SQL_BILLING_TINDAKAN_RALAN_DOKTER, [no_rawat]);
    const [rowsTindakanRalanDokterPetugas] = await db.execute(SQL_BILLING_TINDAKAN_RALAN_DOKTER_PETUGAS, [no_rawat]);
    const [rowsObat] = await db.execute(SQL_BILLING_OBAT, [no_rawat]);
    const [rowsRadiologi] = await db.execute(SQL_BILLING_RADIOLOGI, [no_rawat]);
    const [rowsLaboratorium] = await db.execute(SQL_BILLING_LABORATORIUM, [no_rawat]);
    
    // Gabung hasil
    const allRows = [...rowsTindakanRanapPetugas, ...rowsTindakanRanapDokter, ...rowsTindakanRanapDokterPetugas, ...rowsTindakanRalanPetugas, ...rowsTindakanRalanDokter, ...rowsTindakanRalanDokterPetugas, ...rowsObat, ...rowsRadiologi, ...rowsLaboratorium];

    const groupsMap = {};
    let grand_total = 0;

    for (const r of allRows) {
      if (!groupsMap[r.status]) {
        groupsMap[r.status] = {
          status: r.status,
          items: [],
          subtotal: 0
        };
      }

      groupsMap[r.status].items.push({
        nama: r.nama_brng,
        jenis: r.jenis,
        jumlah: r.jml,
        biaya: r.biaya_obat,
        total: r.total
      });

      groupsMap[r.status].subtotal += Number(r.total); 
      grand_total += Number(r.total);
    }

    const response = {
      no_rawat,
      groups: Object.values(groupsMap),
      grand_total
    };

    res.json(response);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Terjadi kesalahan pada server", message: error.message });
  }
});

app.listen(3000, () => {
  console.log("Server berjalan di port 3000");
  console.log("Coba buka: http://localhost:3000/billing?no_rawat=...");
});
