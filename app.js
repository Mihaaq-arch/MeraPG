import express from "express";
import dotenv from "dotenv";
import db, { dbNew } from "./db.js";
import paymentRoutes from "./payment.js";

dotenv.config();

const app = express();
app.use(express.json()); // Untuk parsing body JSON (POST)

// ============================================================
// CONSTANTS
// ============================================================
const STATUS_ORDER = ['Registrasi', 'Akomodasi', 'Ralan', 'Ranap', 'Retur'];

// ============================================================
// SQL QUERIES
// ============================================================

const SQL_REGISTRASI = `
SELECT
    'Registrasi' AS nama_brng,
    rp.biaya_reg AS biaya_obat,
    1 AS jml,
    0 AS embalase,
    0 AS tuslah,
    rp.biaya_reg AS total,
    'Registrasi' AS status,
    pj.png_jawab AS jenis
FROM reg_periksa rp
JOIN penjab pj ON rp.kd_pj = pj.kd_pj
WHERE rp.no_rawat = ?
`;

const SQL_BILLING_KAMAR = `
SELECT
    CONCAT(ki.kd_kamar, ' - ', b.nm_bangsal) AS nama_brng,
    ki.trf_kamar AS biaya_obat,
    ki.lama AS jml,
    0 AS embalase,
    0 AS tuslah,
    ki.ttl_biaya AS total,
    'Akomodasi' AS status,
    'Kamar' AS jenis
FROM kamar_inap ki
JOIN kamar k      ON ki.kd_kamar = k.kd_kamar
JOIN bangsal b    ON k.kd_bangsal = b.kd_bangsal
WHERE ki.no_rawat = ?
ORDER BY ki.tgl_masuk, ki.kd_kamar;
`;

const SQL_BILLING_TINDAKAN_RALAN = `
SELECT nama_brng, biaya_obat, jml, embalase, tuslah, total, status, jenis FROM (
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
  GROUP BY rip.no_rawat, rip.kd_jenis_prw, rip.biaya_rawat, jpi.nm_perawatan, kp.nm_kategori

  UNION ALL

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
  GROUP BY rip.no_rawat, rip.kd_jenis_prw, rip.biaya_rawat, jpi.nm_perawatan, kp.nm_kategori

  UNION ALL

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
  GROUP BY rip.no_rawat, rip.kd_jenis_prw, rip.biaya_rawat, jpi.nm_perawatan, kp.nm_kategori
) x ORDER BY jenis, nama_brng;
`;

const SQL_BILLING_TINDAKAN_RANAP = `
SELECT nama_brng, biaya_obat, jml, embalase, tuslah, total, status, jenis FROM (
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
  GROUP BY rip.no_rawat, rip.kd_jenis_prw, rip.biaya_rawat, jpi.nm_perawatan, kp.nm_kategori

  UNION ALL

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
  GROUP BY rip.no_rawat, rip.kd_jenis_prw, rip.biaya_rawat, jpi.nm_perawatan, kp.nm_kategori

  UNION ALL

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
  GROUP BY rip.no_rawat, rip.kd_jenis_prw, rip.biaya_rawat, jpi.nm_perawatan, kp.nm_kategori
) x ORDER BY jenis, nama_brng;
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

const SQL_BILLING_OPERASI = `
SELECT
    nm_perawatan AS nama_brng,
    biaya as biaya_obat,
    1 AS jml,
    0 AS embalase,
    0 AS tuslah,
    biaya AS total,
    status,
    jenis
FROM (
    SELECT
        po.nm_perawatan,
        (
            COALESCE(o.biayaoperator1,0)+COALESCE(o.biayaoperator2,0)+COALESCE(o.biayaoperator3,0)+
            COALESCE(o.biayaasisten_operator1,0)+COALESCE(o.biayaasisten_operator2,0)+COALESCE(o.biayaasisten_operator3,0)+
            COALESCE(o.biayainstrumen,0)+COALESCE(o.biayadokter_anak,0)+COALESCE(o.biayaperawaat_resusitas,0)+
            COALESCE(o.biayadokter_anestesi,0)+COALESCE(o.biayaasisten_anestesi,0)+COALESCE(o.biayaasisten_anestesi2,0)+
            COALESCE(o.biayabidan,0)+COALESCE(o.biayabidan2,0)+COALESCE(o.biayabidan3,0)+COALESCE(o.biayaperawat_luar,0)+
            COALESCE(o.biayaalat,0)+COALESCE(o.biayasewaok,0)+COALESCE(o.akomodasi,0)+COALESCE(o.bagian_rs,0)+
            COALESCE(o.biaya_omloop,0)+COALESCE(o.biaya_omloop2,0)+COALESCE(o.biaya_omloop3,0)+COALESCE(o.biaya_omloop4,0)+
            COALESCE(o.biaya_omloop5,0)+COALESCE(o.biayasarpras,0)+COALESCE(o.biaya_dokter_pjanak,0)+COALESCE(o.biaya_dokter_umum,0)
        ) AS biaya,
        o.status,
        "OPERASI" AS jenis
    FROM operasi o
    JOIN paket_operasi po ON o.kode_paket = po.kode_paket
    WHERE o.no_rawat = ?
) x;
`;

const SQL_RETUR_OBAT = `
SELECT
    'Retur Obat' AS nama_brng,
    SUM(drj.subtotal) * -1 AS biaya_obat,
    1 AS jml,
    0 AS embalase,
    0 AS tuslah,
    SUM(drj.subtotal) * -1 AS total,
    'Retur' AS status,
    'Obat' AS jenis
FROM detreturjual drj
JOIN returjual rj ON rj.no_retur_jual = drj.no_retur_jual
WHERE rj.no_retur_jual LIKE ?
`;

// ============================================================
// QUERY REGISTRY
// Tambah query baru? Cukup tambahkan entry di sini.
// ============================================================
const BILLING_QUERIES = [
  { sql: SQL_REGISTRASI,             params: nr => [nr] },
  { sql: SQL_BILLING_KAMAR,          params: nr => [nr] },
  { sql: SQL_BILLING_TINDAKAN_RALAN, params: nr => [nr, nr, nr] },
  { sql: SQL_BILLING_TINDAKAN_RANAP, params: nr => [nr, nr, nr] },
  { sql: SQL_BILLING_OBAT,           params: nr => [nr] },
  { sql: SQL_BILLING_RADIOLOGI,      params: nr => [nr] },
  { sql: SQL_BILLING_LABORATORIUM,   params: nr => [nr] },
  { sql: SQL_BILLING_OPERASI,        params: nr => [nr] },
  { sql: SQL_RETUR_OBAT,             params: nr => [`%${nr}%`] },
];

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Eksekusi semua billing queries secara paralel,
 * return flat array of billing items.
 */
async function fetchBillingItems(no_rawat) {
  const results = await Promise.all(
    BILLING_QUERIES.map(q => db.execute(q.sql, q.params(no_rawat)))
  );
  // Setiap result = [rows, fields], ambil rows (index 0) lalu flatten
  // Filter: sembunyikan item dengan total = 0
  return results.flatMap(([rows]) => rows).filter(r => Number(r.total) !== 0);
}

/**
 * Ambil data pembayaran dari 2 sumber:
 * 1. billing_payment (mera_db) — pembayaran via MeraPG (per item)
 * 2. tagihan_sadewa (rsaz_sik) — pembayaran via SIMRS lama (total)
 */
async function fetchPaidItems(no_rawat) {
  // 1. Pembayaran baru dari mera_db
  let paidMap = {};
  let totalPaidNew = 0;
  try {
    const [rows] = await dbNew.execute(
      `SELECT d.nama_item, d.status, d.jenis, SUM(d.total) as total_dibayar
       FROM billing_payment_detail d
       JOIN billing_payment p ON d.no_nota = p.no_nota
       WHERE p.no_rawat = ?
       GROUP BY d.nama_item, d.status, d.jenis`,
      [no_rawat]
    );
    for (const r of rows) {
      const key = `${r.nama_item}|${r.status}|${r.jenis}`;
      paidMap[key] = Number(r.total_dibayar);
      totalPaidNew += Number(r.total_dibayar);
    }
  } catch (e) {
    // mera_db belum siap, lanjut saja
  }

  // 2. Pembayaran lama dari tagihan_sadewa (rsaz_sik)
  let legacyPaid = { found: false, totalBayar: 0, records: [] };
  try {
    const [legacyRows] = await db.execute(
      `SELECT ts.no_nota, ts.tgl_bayar, ts.jenis_bayar, ts.jumlah_tagihan,
              ts.jumlah_bayar, ts.status, ts.petugas
       FROM tagihan_sadewa ts
       WHERE ts.no_nota = ?
       ORDER BY ts.tgl_bayar DESC`,
      [no_rawat]
    );
    if (legacyRows.length > 0) {
      legacyPaid.found = true;
      legacyPaid.records = legacyRows;
      legacyPaid.totalBayar = legacyRows.reduce((s, r) => s + Number(r.jumlah_bayar), 0);
    }
  } catch (e) {
    // tagihan_sadewa tidak tersedia, lanjut saja
  }

  const totalPaid = totalPaidNew + legacyPaid.totalBayar;
  return { paidMap, totalPaid, legacyPaid };
}

/**
 * Group items berdasarkan Status → Jenis.
 * Return { grouped, grand_total }
 */
function groupByStatus(items) {
  const grouped = {};
  let grand_total = 0;

  for (const item of items) {
    const statusKey = item.status || "Lainnya";
    const jenisKey = item.jenis || "Lainnya";

    if (!grouped[statusKey]) grouped[statusKey] = {};
    if (!grouped[statusKey][jenisKey]) grouped[statusKey][jenisKey] = { items: [], subtotal: 0 };

    grouped[statusKey][jenisKey].items.push(item);
    grouped[statusKey][jenisKey].subtotal += Number(item.total);
    grand_total += Number(item.total);
  }

  return { grouped, grand_total };
}

/**
 * Urutkan status sesuai STATUS_ORDER.
 * Status yang tidak ada di ORDER ditambahkan di akhir.
 * Status tanpa data di-skip.
 */
function getOrderedStatuses(grouped) {
  const ordered = STATUS_ORDER.filter(s => grouped[s]);
  for (const s of Object.keys(grouped)) {
    if (!ordered.includes(s)) ordered.push(s);
  }
  return ordered;
}

/**
 * Render HTML billing lengkap dengan payment UI.
 */
function renderBillingHtml(no_rawat, grouped, orderedStatuses, grand_total, paidMap, totalPaid, legacyPaid) {
  const isLegacyFullyPaid = legacyPaid.found && legacyPaid.totalBayar >= grand_total;
  let htmlContent = "";
  let itemIndex = 0;

  for (const status of orderedStatuses) {
    const jenisMap = grouped[status];
    let statusSubtotal = 0;
    let jenisHtml = "";

    for (const [jenis, data] of Object.entries(jenisMap)) {
      statusSubtotal += data.subtotal;
      jenisHtml += `
        <details style="margin-left: 20px; margin-bottom: 8px;" open>
          <summary style="cursor: pointer; padding: 8px; background: #e9e9e9; border-radius: 4px;">
            <strong>${jenis}</strong> — Subtotal: <span style="color: green; font-weight: bold;">Rp ${data.subtotal.toLocaleString()}</span> (${data.items.length} item)
          </summary>
          <table style="width: 100%; margin-top: 8px; border-collapse: collapse; font-size: 14px;">
            <thead>
              <tr style="background: #f5f5f5;">
                <th style="border: 1px solid #ccc; padding: 6px; width: 40px;">Pilih</th>
                <th style="border: 1px solid #ccc; padding: 6px;">Nama</th>
                <th style="border: 1px solid #ccc; padding: 6px; text-align: right;">Biaya</th>
                <th style="border: 1px solid #ccc; padding: 6px; text-align: center;">Jml</th>
                <th style="border: 1px solid #ccc; padding: 6px; text-align: right;">Total</th>
                <th style="border: 1px solid #ccc; padding: 6px; text-align: center;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${data.items.map(r => {
                const key = `${r.nama_brng}|${r.status}|${r.jenis}`;
                const isPaid = isLegacyFullyPaid || paidMap[key] >= Number(r.total);
                const paidVia = isLegacyFullyPaid ? 'SIMRS' : (paidMap[key] >= Number(r.total) ? 'MeraPG' : '');
                const idx = itemIndex++;
                const rowBg = isPaid ? 'background: #e8f5e9;' : '';
                return `
                <tr style="${rowBg}">
                  <td style="border: 1px solid #ccc; padding: 6px; text-align: center;">
                    ${isPaid
                      ? '<span style="color: #999; font-size: 18px;">—</span>'
                      : `<input type="checkbox" class="item-cb" data-idx="${idx}"
                           data-nama="${r.nama_brng.replace(/"/g, '&quot;')}" data-status="${r.status}"
                           data-jenis="${r.jenis}" data-jumlah="${r.jml}"
                           data-biaya="${r.biaya_obat}" data-total="${r.total}" />`
                    }
                  </td>
                  <td style="border: 1px solid #ccc; padding: 6px;">${r.nama_brng}</td>
                  <td style="border: 1px solid #ccc; padding: 6px; text-align: right;">${Number(r.biaya_obat).toLocaleString()}</td>
                  <td style="border: 1px solid #ccc; padding: 6px; text-align: center;">${r.jml}</td>
                  <td style="border: 1px solid #ccc; padding: 6px; text-align: right;">${Number(r.total).toLocaleString()}</td>
                  <td style="border: 1px solid #ccc; padding: 6px; text-align: center;">
                    ${isPaid
                      ? `<span style="background:#198754; color:#fff; padding:2px 8px; border-radius:4px; font-size:12px; font-weight:600;">LUNAS${paidVia ? ' (' + paidVia + ')' : ''}</span>`
                      : '<span style="background:#ffc107; color:#333; padding:2px 8px; border-radius:4px; font-size:12px; font-weight:600;">BELUM</span>'
                    }
                  </td>
                </tr>`;
              }).join("")}
            </tbody>
          </table>
        </details>
      `;
    }

    htmlContent += `
      <details style="margin-bottom: 12px; border: 1px solid #ccc; border-radius: 6px; padding: 10px;" open>
        <summary style="cursor: pointer; font-size: 18px; font-weight: bold; padding: 8px; background: #d0e8ff; border-radius: 4px;">
          Status: ${status} — Total: <span style="color: blue;">Rp ${statusSubtotal.toLocaleString()}</span>
        </summary>
        <div style="margin-top: 10px;">
          ${jenisHtml}
        </div>
      </details>
    `;
  }

  const encodedNr = encodeURIComponent(no_rawat);
  const sisa = grand_total - totalPaid;

  return `
    <html>
    <head>
      <title>Billing: ${no_rawat}</title>
      <style>
        body { font-family: 'Segoe UI', sans-serif; padding: 20px 20px 120px 20px; background: #f9f9f9; }
        h2 { color: #333; }
        .nav-bar { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 16px; }
        .nav-btn {
          padding: 10px 18px; border: none; border-radius: 6px; cursor: pointer;
          font-size: 14px; font-weight: 600; color: #fff; text-decoration: none;
          transition: opacity 0.2s;
        }
        .nav-btn:hover { opacity: 0.85; }
        .btn-home    { background: #6c757d; }
        .btn-billing { background: #0d6efd; }
        .btn-riwayat { background: #6f42c1; }

        .summary-bar {
          display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 16px;
          padding: 14px; background: #1a1a2e; border-radius: 8px; color: #fff;
        }
        .summary-item { flex: 1; text-align: center; min-width: 140px; }
        .summary-label { font-size: 12px; color: #aaa; margin-bottom: 4px; }
        .summary-value { font-size: 20px; font-weight: 700; }
        .summary-value.green { color: #4caf50; }
        .summary-value.red   { color: #ef5350; }
        .summary-value.blue  { color: #42a5f5; }

        .pay-bar {
          position: fixed; bottom: 0; left: 0; right: 0;
          background: #16213e; color: #fff; padding: 14px 24px;
          display: flex; align-items: center; justify-content: space-between;
          box-shadow: 0 -4px 12px rgba(0,0,0,0.3); z-index: 100;
        }
        .pay-bar .pay-info { font-size: 14px; }
        .pay-bar .pay-total { font-size: 20px; font-weight: 700; color: #4caf50; }
        .pay-bar .pay-actions { display: flex; gap: 10px; align-items: center; }
        .pay-btn {
          padding: 10px 24px; border: none; border-radius: 8px; cursor: pointer;
          font-size: 15px; font-weight: 700; color: #fff; transition: all 0.2s;
        }
        .pay-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .pay-btn-bayar { background: #198754; }
        .pay-btn-bayar:hover:not(:disabled) { background: #157347; }
        .pay-btn-all { background: #0d6efd; }
        .pay-btn-all:hover { background: #0b5ed7; }
        .pay-btn-none { background: #6c757d; }
        .pay-btn-none:hover { background: #5c636a; }

        .kasir-input {
          padding: 8px 12px; border: 1px solid #444; border-radius: 6px;
          background: #0f3460; color: #fff; font-size: 14px; width: 140px;
        }

        .toast {
          position: fixed; top: 20px; right: 20px; padding: 14px 20px;
          border-radius: 8px; color: #fff; font-weight: 600; z-index: 200;
          display: none; animation: slideIn 0.3s ease;
        }
        .toast.success { background: #198754; }
        .toast.error { background: #dc3545; }
        @keyframes slideIn { from { transform: translateX(100%); opacity:0; } to { transform: translateX(0); opacity:1; } }
      </style>
    </head>
    <body>
      <div id="toast" class="toast"></div>

      <div class="nav-bar">
        <a class="nav-btn btn-home" href="/">🏠 Home</a>
        <a class="nav-btn btn-billing" href="/billing?no_rawat=${encodedNr}">🔄 Refresh</a>
        <a class="nav-btn btn-riwayat" href="/payment/riwayat/${encodedNr}">📜 Riwayat JSON</a>
      </div>

      <h2>Billing: ${no_rawat}</h2>

      ${legacyPaid.found ? `
      <div style="padding: 12px 16px; margin-bottom: 16px; border-radius: 8px; background: #e8f5e9; border: 1px solid #4caf50; display: flex; align-items: center; gap: 10px;">
        <span style="font-size: 22px;">✅</span>
        <div>
          <strong style="color: #2e7d32;">Sudah dibayar via SIMRS</strong><br/>
          <span style="font-size: 13px; color: #555;">
            Total: Rp ${legacyPaid.totalBayar.toLocaleString()}
            ${legacyPaid.records.map(r => ` — ${r.jenis_bayar} (${r.no_nota}, ${r.petugas || '-'})`).join('')}
          </span>
        </div>
      </div>
      ` : ''}

      <div class="summary-bar">
        <div class="summary-item">
          <div class="summary-label">Total Tagihan</div>
          <div class="summary-value blue">Rp ${grand_total.toLocaleString()}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">Sudah Dibayar</div>
          <div class="summary-value green">Rp ${totalPaid.toLocaleString()}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">Sisa</div>
          <div class="summary-value ${sisa > 0 ? 'red' : 'green'}">Rp ${sisa.toLocaleString()}</div>
        </div>
      </div>

      ${htmlContent}

      <!-- Floating Payment Bar -->
      <div class="pay-bar">
        <div>
          <div class="pay-info">Terpilih: <strong id="selectedCount">0</strong> item</div>
          <div class="pay-total" id="selectedTotal">Rp 0</div>
        </div>
        <div class="pay-actions">
          <button class="pay-btn pay-btn-all" onclick="selectAll()">Pilih Semua</button>
          <button class="pay-btn pay-btn-none" onclick="deselectAll()">Batal Pilih</button>
          <input class="kasir-input" id="kasirId" placeholder="ID Kasir" value="admin" />
          <button class="pay-btn pay-btn-bayar" id="btnBayar" disabled onclick="bayar()">💰 Bayar</button>
        </div>
      </div>

      <script>
        const noRawat = '${no_rawat.replace(/'/g, "\\'")}';

        function getChecked() {
          return [...document.querySelectorAll('.item-cb:checked')];
        }

        function updateTotal() {
          const checked = getChecked();
          const total = checked.reduce((s, cb) => s + Number(cb.dataset.total), 0);
          document.getElementById('selectedCount').textContent = checked.length;
          document.getElementById('selectedTotal').textContent = 'Rp ' + total.toLocaleString();
          document.getElementById('btnBayar').disabled = checked.length === 0;
        }

        document.addEventListener('change', e => {
          if (e.target.classList.contains('item-cb')) updateTotal();
        });

        function selectAll() {
          document.querySelectorAll('.item-cb').forEach(cb => cb.checked = true);
          updateTotal();
        }
        function deselectAll() {
          document.querySelectorAll('.item-cb').forEach(cb => cb.checked = false);
          updateTotal();
        }

        function showToast(msg, type) {
          const t = document.getElementById('toast');
          t.textContent = msg;
          t.className = 'toast ' + type;
          t.style.display = 'block';
          setTimeout(() => t.style.display = 'none', 3000);
        }

        async function bayar() {
          const checked = getChecked();
          if (checked.length === 0) return;
          const kasir = document.getElementById('kasirId').value.trim();
          if (!kasir) { alert('Masukkan ID Kasir'); return; }

          const items = checked.map(cb => ({
            nama_item: cb.dataset.nama,
            status: cb.dataset.status,
            jenis: cb.dataset.jenis,
            jumlah: Number(cb.dataset.jumlah),
            biaya: Number(cb.dataset.biaya),
            total: Number(cb.dataset.total)
          }));

          const totalBayar = items.reduce((s, i) => s + i.total, 0);
          if (!confirm('Bayar ' + items.length + ' item senilai Rp ' + totalBayar.toLocaleString() + '?')) return;

          document.getElementById('btnBayar').disabled = true;
          document.getElementById('btnBayar').textContent = '⏳ Memproses...';

          try {
            const resp = await fetch('/payment/bayar', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ no_rawat: noRawat, id_user_kasir: kasir, items })
            });
            const data = await resp.json();
            if (resp.ok) {
              showToast('✅ Pembayaran berhasil! Nota: ' + data.no_nota, 'success');
              setTimeout(() => location.reload(), 1500);
            } else {
              showToast('❌ Gagal: ' + (data.error || data.message), 'error');
              document.getElementById('btnBayar').disabled = false;
              document.getElementById('btnBayar').textContent = '💰 Bayar';
            }
          } catch (err) {
            showToast('❌ Error: ' + err.message, 'error');
            document.getElementById('btnBayar').disabled = false;
            document.getElementById('btnBayar').textContent = '💰 Bayar';
          }
        }
      </script>
    </body>
    </html>
  `;
}

// ============================================================
// HOME PAGE
// ============================================================

app.get("/", (req, res) => {
  res.send(`
    <html>
    <head>
      <title>MeraPG — Home</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Segoe UI', sans-serif; background: #1a1a2e; color: #eee; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
        .card { background: #16213e; padding: 40px; border-radius: 16px; width: 420px; box-shadow: 0 8px 32px rgba(0,0,0,0.3); }
        h1 { font-size: 28px; margin-bottom: 6px; color: #e94560; }
        .subtitle { color: #888; margin-bottom: 28px; font-size: 14px; }
        label { display: block; font-size: 13px; color: #aaa; margin-bottom: 6px; }
        input {
          width: 100%; padding: 12px 14px; border: 1px solid #333; border-radius: 8px;
          background: #0f3460; color: #fff; font-size: 15px; margin-bottom: 20px; outline: none;
        }
        input:focus { border-color: #e94560; }
        .buttons { display: flex; flex-direction: column; gap: 10px; }
        .btn {
          padding: 12px; border: none; border-radius: 8px; cursor: pointer;
          font-size: 15px; font-weight: 600; color: #fff; transition: opacity 0.2s;
          text-align: center;
        }
        .btn:hover { opacity: 0.85; }
        .btn-billing { background: #0d6efd; }
        .btn-status  { background: #198754; }
        .btn-riwayat { background: #6f42c1; }
        .footer { margin-top: 24px; text-align: center; font-size: 12px; color: #555; }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>MeraPG</h1>
        <p class="subtitle">Billing & Payment Gateway</p>
        <label for="noRawat">No. Rawat</label>
        <input type="text" id="noRawat" placeholder="2024/01/15/000001" autofocus />
        <div class="buttons">
          <button class="btn btn-billing" onclick="go('billing')">📋 Lihat Billing</button>
          <button class="btn btn-status"  onclick="go('status')">✅ Status Pembayaran</button>
          <button class="btn btn-riwayat" onclick="go('riwayat')">📜 Riwayat Pembayaran</button>
        </div>
        <div class="footer">rsaz_sik (read) · mera_db (write)</div>
      </div>
      <script>
        function go(type) {
          const nr = document.getElementById('noRawat').value.trim();
          if (!nr) { alert('Masukkan No. Rawat terlebih dahulu'); return; }
          const encoded = encodeURIComponent(nr);
          if (type === 'billing') window.location.href = '/billing?no_rawat=' + encoded;
          else if (type === 'status') window.location.href = '/payment/status/' + encoded;
          else if (type === 'riwayat') window.location.href = '/payment/riwayat/' + encoded;
        }
        document.getElementById('noRawat').addEventListener('keydown', e => {
          if (e.key === 'Enter') go('billing');
        });
      </script>
    </body>
    </html>
  `);
});

// ============================================================
// ROUTES
// ============================================================

// Endpoint 1: /billing?no_rawat=... — HTML (browser) atau JSON (API)
app.get("/billing", async (req, res) => {
  const { no_rawat } = req.query;

  if (!no_rawat) {
    return res.status(400).send("no_rawat wajib disertakan (contoh: ?no_rawat=2022/02/02/000002)");
  }

  try {
    // Fetch billing + payment data in parallel
    const [allItems, { paidMap, totalPaid, legacyPaid }] = await Promise.all([
      fetchBillingItems(no_rawat),
      fetchPaidItems(no_rawat).catch(() => ({ paidMap: {}, totalPaid: 0, legacyPaid: { found: false, totalBayar: 0, records: [] } }))
    ]);
    const { grouped, grand_total } = groupByStatus(allItems);
    const orderedStatuses = getOrderedStatuses(grouped);

    const jsonResponse = { no_rawat, items: allItems, grand_total, totalPaid, sisa: grand_total - totalPaid, legacyPaid };

    // Tampilan HTML untuk browser
    if (req.headers.accept?.includes("text/html")) {
      return res.send(renderBillingHtml(no_rawat, grouped, orderedStatuses, grand_total, paidMap, totalPaid, legacyPaid));
    }

    // Response JSON untuk API
    res.json(jsonResponse);

  } catch (error) {
    console.error(error);
    res.status(500).send("Terjadi kesalahan pada server: " + error.message);
  }
});

// Endpoint 2: /billing/:no_rawat — JSON grouped by status
app.get("/billing/:no_rawat", async (req, res) => {
  const { no_rawat } = req.params;

  try {
    const allItems = await fetchBillingItems(no_rawat);
    const { grouped, grand_total } = groupByStatus(allItems);
    const orderedStatuses = getOrderedStatuses(grouped);

    // Format response: groups = array of { status, items[], subtotal }
    const groups = orderedStatuses.map(status => {
      const jenisMap = grouped[status];
      const items = [];
      let subtotal = 0;
      for (const [jenis, data] of Object.entries(jenisMap)) {
        for (const item of data.items) {
          items.push({
            nama: item.nama_brng,
            jenis: item.jenis,
            jumlah: item.jml,
            biaya: item.biaya_obat,
            total: item.total
          });
        }
        subtotal += data.subtotal;
      }
      return { status, items, subtotal };
    });

    res.json({ no_rawat, groups, grand_total });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Terjadi kesalahan pada server", message: error.message });
  }
});

// ============================================================
// MOUNT ROUTES
// ============================================================
app.use("/payment", paymentRoutes);

// ============================================================
// START SERVER
// ============================================================
app.listen(3000, () => {
  console.log("Server berjalan di port 3000");
  console.log("Coba buka: http://localhost:3000/billing?no_rawat=...");
});
