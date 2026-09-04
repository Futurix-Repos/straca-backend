const mongoose = require("mongoose");

const vehicleDriverAssignmentSchema = new mongoose.Schema(
  {
    vehicle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vehicle",
      required: true,
    },
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Driver",
      required: true,
    },
    linkType: {
      type: String,
      enum: ["current", "future"],
      required: true,
      default: "current",
    },
    startsAt: { type: Date, default: Date.now },
    endsAt: { type: Date, default: null },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true, collection: "vehicleDriverAssignments" },
);

vehicleDriverAssignmentSchema.index(
  { vehicle: 1, linkType: 1 },
  { unique: true, partialFilterExpression: { endsAt: null } },
);
vehicleDriverAssignmentSchema.index({ driver: 1, linkType: 1 });

module.exports = mongoose.model(
  "VehicleDriverAssignment",
  vehicleDriverAssignmentSchema,
);
