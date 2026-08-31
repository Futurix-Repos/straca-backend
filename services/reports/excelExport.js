const ExcelJS = require("exceljs");
const { statusFr } = require("./labels");

function formatDateTime(date) {
  if (!date) return "";
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Africa/Porto-Novo",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(date));
}

async function buildDeliveriesWorkbook(deliveries, { sheetName = "Voyages", periodLabel } = {}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Straca";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(sheetName);

  sheet.columns = [
    { header: "Référence", key: "reference", width: 16 },
    { header: "Créé le", key: "createdAt", width: 18 },
    { header: "Véhicule", key: "vehicle", width: 16 },
    { header: "Chantier départ", key: "chantier", width: 22 },
    { header: "Section", key: "section", width: 18 },
    { header: "Destination", key: "destination", width: 24 },
    { header: "Commande", key: "order", width: 16 },
    { header: "Produit", key: "product", width: 20 },
    { header: "Quantité", key: "quantity", width: 12 },
    { header: "Unité", key: "unit", width: 10 },
    { header: "Statut", key: "status", width: 14 },
  ];

  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0F172A" },
  };
  sheet.getRow(1).alignment = { vertical: "middle", horizontal: "left" };
  sheet.getRow(1).height = 22;

  for (const d of deliveries) {
    sheet.addRow({
      reference: d.reference || "",
      createdAt: formatDateTime(d.createdAt),
      vehicle: d.vehicle?.registrationNumber || d.vehicle?.name || "",
      chantier: d.departureChantier?.label || "",
      section: d.departureSection?.label || "",
      destination: d.destination?.name || d.destinationCarriere?.label || "",
      order: d.order?.reference || "",
      product: d.productMeasureUnit?.product?.name || "",
      quantity: d.receiver?.quantity ?? d.sender?.quantity ?? 0,
      unit: d.productMeasureUnit?.measureUnit?.label || "",
      status: statusFr(d.status),
    });
  }

  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: sheet.columns.length },
  };
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  if (periodLabel) {
    workbook.properties = {
      ...workbook.properties,
      title: `Voyages ${periodLabel}`,
    };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

module.exports = { buildDeliveriesWorkbook };
