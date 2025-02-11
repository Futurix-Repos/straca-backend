const mongoose = require("mongoose");
const vehicleTypeSchema = mongoose.Schema(
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

vehicleTypeSchema.virtual("vehicles", {
  ref: "Vehicle",
  localField: "_id",
  foreignField: "type",
});

const VehicleType = mongoose.model("VehicleType", vehicleTypeSchema);
module.exports = VehicleType;
