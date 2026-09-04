const mongoose = require("mongoose");

const locationSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    code: { type: String, trim: true, default: null },
    externalIds: { type: mongoose.Schema.Types.Mixed, default: undefined },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  },
);

locationSchema.index(
  { code: 1 },
  { unique: true, partialFilterExpression: { code: { $type: "string" } } },
);
locationSchema.index(
  { "externalIds.odoo": 1 },
  {
    unique: true,
    partialFilterExpression: { "externalIds.odoo": { $exists: true } },
  },
);

const LocationModel = mongoose.model("Location", locationSchema);

module.exports = LocationModel;
