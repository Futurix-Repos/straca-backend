const mongoose = require("mongoose");

const measureUnitSchema = mongoose.Schema(
  {
    _id: mongoose.Schema.Types.ObjectId,
    label: { type: String, required: true },
    description: { type: String, required: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

measureUnitSchema.virtual("products", {
  ref: "ProductMeasureUnit",
  localField: "_id",
  foreignField: "measureUnit",
});

module.exports = mongoose.model("MeasureUnit", measureUnitSchema);
