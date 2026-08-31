const { statusFr } = require("./labels");

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const wrap = (title, body) => `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
</head>
<body style="font-family:Arial,sans-serif;color:#1a1a1a;background:#f5f7fa;margin:0;padding:24px">
  <div style="max-width:720px;margin:0 auto;background:#fff;border-radius:12px;padding:28px;box-shadow:0 1px 3px rgba(0,0,0,0.06)">
    <h1 style="margin:0 0 6px 0;font-size:22px;color:#0f172a">${escapeHtml(title)}</h1>
    ${body}
    <p style="margin-top:32px;font-size:12px;color:#94a3b8">Rapport généré automatiquement par Straca. La liste détaillée des voyages est en pièce jointe (Excel).</p>
  </div>
</body>
</html>`;

const statCard = (label, value) => `
<div style="flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px;text-align:center">
  <div style="font-size:22px;font-weight:700;color:#0f172a">${escapeHtml(value)}</div>
  <div style="font-size:12px;color:#64748b;margin-top:4px;text-transform:uppercase;letter-spacing:0.5px">${escapeHtml(label)}</div>
</div>`;

const statusBadge = (status) => {
  const colors = {
    DELIVERED: "#16a34a",
    PENDING: "#f59e0b",
    IN_PROGRESS: "#2563eb",
    CANCELED: "#dc2626",
  };
  const color = colors[status] || "#64748b";
  return `<span style="display:inline-block;padding:2px 8px;border-radius:999px;background:${color}20;color:${color};font-size:11px;font-weight:600">${escapeHtml(statusFr(status))}</span>`;
};

function summaryBlock(summary) {
  const statusList = Object.entries(summary.byStatus)
    .map(([s, n]) => `${statusBadge(s)} <strong>${n}</strong>`)
    .join(" · ");

  const productRows = summary.byProduct.length
    ? summary.byProduct
        .map(
          (p) => `
        <tr>
          <td style="padding:6px 8px;border-bottom:1px solid #f1f5f9">${escapeHtml(p.productName)}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #f1f5f9;text-align:right">${p.count}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #f1f5f9;text-align:right">${p.quantity} ${escapeHtml(p.unit)}</td>
        </tr>`,
        )
        .join("")
    : `<tr><td colspan="3" style="padding:12px;text-align:center;color:#94a3b8">—</td></tr>`;

  const vehicleRows = summary.topVehicles.length
    ? summary.topVehicles
        .map(
          (v) => `
        <tr>
          <td style="padding:6px 8px;border-bottom:1px solid #f1f5f9">${escapeHtml(v.plate)}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #f1f5f9;text-align:right">${v.count}</td>
        </tr>`,
        )
        .join("")
    : `<tr><td colspan="2" style="padding:12px;text-align:center;color:#94a3b8">—</td></tr>`;

  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0">
    <tr>
      <td width="49%" style="vertical-align:top">${statCard("Voyages", summary.total)}</td>
      <td width="2%" style="font-size:0;line-height:0">&nbsp;</td>
      <td width="49%" style="vertical-align:top">${statCard("Quantité totale", summary.totalQuantity)}</td>
    </tr>
  </table>
  <p style="margin:8px 0 20px 0;font-size:13px;color:#475569">${statusList || "Aucun voyage"}</p>

  <h3 style="margin:24px 0 6px 0;font-size:14px;color:#0f172a">Par produit</h3>
  <table style="width:100%;border-collapse:collapse;font-size:13px">
    <thead>
      <tr style="background:#f8fafc;color:#475569;text-align:left">
        <th style="padding:8px">Produit</th>
        <th style="padding:8px;text-align:right">Voyages</th>
        <th style="padding:8px;text-align:right">Quantité</th>
      </tr>
    </thead>
    <tbody>${productRows}</tbody>
  </table>

  <h3 style="margin:24px 0 6px 0;font-size:14px;color:#0f172a">Top véhicules</h3>
  <table style="width:100%;border-collapse:collapse;font-size:13px">
    <thead>
      <tr style="background:#f8fafc;color:#475569;text-align:left">
        <th style="padding:8px">Immatriculation</th>
        <th style="padding:8px;text-align:right">Voyages</th>
      </tr>
    </thead>
    <tbody>${vehicleRows}</tbody>
  </table>`;
}

const SUBJECT_PREFIX = "Straca Voyages";

function buildDailyReport({ label, summary }) {
  const title = `${SUBJECT_PREFIX} - Rapport journalier - ${label}`;
  const body = `
    <p style="margin:0 0 8px 0;color:#475569">Synthèse des voyages du ${escapeHtml(label)}.</p>
    ${summaryBlock(summary)}
  `;
  return { subject: title, html: wrap(title, body) };
}

function buildWeeklyReport({ label, summary }) {
  const title = `${SUBJECT_PREFIX} - Rapport hebdomadaire - ${label}`;
  const body = `
    <p style="margin:0 0 8px 0;color:#475569">Synthèse des voyages de la semaine.</p>
    ${summaryBlock(summary)}
  `;
  return { subject: title, html: wrap(title, body) };
}

function buildMonthlyReport({ label, summary, previous }) {
  const title = `${SUBJECT_PREFIX} - Rapport mensuel - ${label}`;
  const delta = summary.total - previous.summary.total;
  const deltaText =
    delta === 0
      ? "identique au mois précédent"
      : delta > 0
        ? `+${delta} voyages vs mois précédent`
        : `${delta} voyages vs mois précédent`;
  const deltaColor = delta >= 0 ? "#16a34a" : "#dc2626";

  const body = `
    <p style="margin:0 0 8px 0;color:#475569">Synthèse mensuelle des voyages.</p>
    <p style="margin:0 0 16px 0;color:${deltaColor};font-weight:600">${escapeHtml(deltaText)}</p>
    ${summaryBlock(summary)}
    <h3 style="margin:32px 0 6px 0;font-size:14px;color:#0f172a">Mois précédent (${escapeHtml(previous.label)})</h3>
    <p style="color:#475569;font-size:13px;margin:0">${previous.summary.total} voyages · ${previous.summary.totalQuantity} unités livrées.</p>
  `;
  return { subject: title, html: wrap(title, body) };
}

module.exports = {
  buildDailyReport,
  buildWeeklyReport,
  buildMonthlyReport,
};
