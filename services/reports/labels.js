const STATUS_FR = {
  PENDING: "En attente",
  IN_PROGRESS: "En cours",
  DELIVERED: "Livré",
  CANCELED: "Annulé",
};

function statusFr(status) {
  return STATUS_FR[status] || status || "—";
}

module.exports = { STATUS_FR, statusFr };
