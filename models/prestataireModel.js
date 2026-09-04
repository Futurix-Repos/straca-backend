const mongoose = require("mongoose");

const prestataireSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, default: null, trim: true },
    email: { type: String, default: null, trim: true, lowercase: true },
    phone: { type: String, default: null, trim: true },
    address: { type: String, default: null, trim: true },
    zone: { type: String, default: null, trim: true },
    ifu: { type: String, default: null, trim: true },
    rccm: { type: String, default: null, trim: true },
    odooId: { type: Number, default: null },
    externalIds: { type: mongoose.Schema.Types.Mixed, default: undefined },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

prestataireSchema.index(
  { "externalIds.odoo": 1 },
  {
    unique: true,
    partialFilterExpression: { "externalIds.odoo": { $exists: true } },
  },
);

module.exports = mongoose.model("Prestataire", prestataireSchema);
