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
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Prestataire", prestataireSchema);
