const mongoose = require("mongoose");
const vehicleSourceSchema = mongoose.Schema(
  {
    label: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    isExternal: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamp: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

vehicleSourceSchema.virtual("vehicles", {
  ref: "Vehicle",
  localField: "_id",
  foreignField: "source",
});

const VehicleSource = mongoose.model("VehicleSource", vehicleSourceSchema);
module.exports = VehicleSource;
