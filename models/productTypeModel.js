const mongoose = require("mongoose");

const productTypeSchema = mongoose.Schema(
  {
    _id: mongoose.Schema.Types.ObjectId,
    label: { type: String, required: true },
    description: { type: String, required: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true }, // Enable virtuals
    toObject: { virtuals: true },
  },
);

// Virtual populate
productTypeSchema.virtual("products", {
  ref: "Product",
  localField: "_id",
  foreignField: "productType",
});

module.exports = mongoose.model("ProductType", productTypeSchema);
