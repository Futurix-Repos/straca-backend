const mongoose = require("mongoose");
const vehicleBrandSchema = mongoose.Schema(
  {
    label: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
  },
  {
    timestamp: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

vehicleBrandSchema.virtual("models", {
  ref: "VehicleModel",
  localField: "_id",
  foreignField: "brand",
});

const VehicleBrand = mongoose.model("VehicleBrand", vehicleBrandSchema);
module.exports = VehicleBrand;
