const mongoose = require("mongoose");
const vehicleModelSchema = mongoose.Schema(
  {
    label: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    brand: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "VehicleBrand",
      required: true,
    },
  },
  {
    timestamp: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

vehicleModelSchema.virtual("vehicles", {
  ref: "Vehicle",
  localField: "_id",
  foreignField: "model",
});

const VehicleModel = mongoose.model("VehicleModel", vehicleModelSchema);
module.exports = VehicleModel;
