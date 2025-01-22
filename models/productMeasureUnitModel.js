const mongoose = require("mongoose");

const productMeasureUnitSchema = mongoose.Schema(
  {
    amount: {
      type: Number,
      required: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    measureUnit: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MeasureUnit",
      required: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

// Prevent duplicate combinations of product and measure unit
productMeasureUnitSchema.index(
  { product: 1, measureUnit: 1 },
  { unique: true },
);

module.exports = mongoose.model("ProductMeasureUnit", productMeasureUnitSchema);
