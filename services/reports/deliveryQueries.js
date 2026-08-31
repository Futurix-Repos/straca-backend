const Delivery = require("../../models/deliveryModel");

const populatePaths = [
  { path: "departureChantier", select: "label" },
  { path: "departureSection", select: "label" },
  { path: "destination", select: "name" },
  { path: "destinationCarriere", select: "label" },
  { path: "vehicle", select: "name registrationNumber" },
  { path: "order", select: "reference" },
  {
    path: "productMeasureUnit",
    populate: [
      { path: "product", select: "name" },
      { path: "measureUnit", select: "label" },
    ],
  },
];

async function findDeliveriesBetween(start, end) {
  return Delivery.find({ createdAt: { $gte: start, $lte: end } })
    .populate(populatePaths)
    .sort({ createdAt: 1 })
    .lean();
}

function summarize(deliveries) {
  const byStatus = {};
  const byProduct = new Map();
  const byVehicle = new Map();
  let totalQuantity = 0;

  for (const d of deliveries) {
    byStatus[d.status] = (byStatus[d.status] || 0) + 1;

    const productName = d.productMeasureUnit?.product?.name || "Inconnu";
    const unit = d.productMeasureUnit?.measureUnit?.label || "";
    const qty = Number(d.receiver?.quantity ?? d.sender?.quantity ?? 0);
    totalQuantity += qty;

    const productKey = `${productName}|${unit}`;
    const prev = byProduct.get(productKey) || { productName, unit, quantity: 0, count: 0 };
    prev.quantity += qty;
    prev.count += 1;
    byProduct.set(productKey, prev);

    const plate = d.vehicle?.registrationNumber || d.vehicle?.name || "N/A";
    byVehicle.set(plate, (byVehicle.get(plate) || 0) + 1);
  }

  const topVehicles = [...byVehicle.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([plate, count]) => ({ plate, count }));

  return {
    total: deliveries.length,
    byStatus,
    byProduct: [...byProduct.values()].sort((a, b) => b.count - a.count),
    topVehicles,
    totalQuantity,
  };
}

module.exports = { findDeliveriesBetween, summarize };
