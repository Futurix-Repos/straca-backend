const mongoose = require("mongoose");
const { normalizePlate } = require("../helpers/referenceNormalization");

const vehicleSchema = new mongoose.Schema(
  {
    _id: mongoose.Schema.Types.ObjectId,
    registrationNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    plateRaw: {
      type: String,
      trim: true,
      minlength: 2,
      maxlength: 30,
    },
    plateNormalized: {
      type: String,
      trim: true,
    },
    tracking: {
      id: { type: String, unique: true, sparse: true },
      plate: { type: String, unique: true, sparse: true },
    },
    model: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "VehicleModel",
      required: true,
    },
    type: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "VehicleType",
      required: true,
    },
    source: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "VehicleSource",
      required: true,
    },
    prestataire: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Prestataire",
      default: null,
    },
    status: {
      type: String,
      enum: ["pending", "verified", "inactive"],
      default: "verified",
    },
    externalIds: { type: mongoose.Schema.Types.Mixed, default: undefined },
    metadata: { type: mongoose.Schema.Types.Mixed, default: undefined },
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

vehicleSchema.pre("validate", async function (next) {
  try {
    const plate = this.plateRaw || this.registrationNumber;
    if (plate) {
      this.plateRaw = plate.trim();
      this.registrationNumber = this.plateRaw;
      this.plateNormalized = normalizePlate(this.plateRaw);
    }

    // Only proceed with validation if source is provided
    if (this.source) {
      const VehicleSource = mongoose.model("VehicleSource");
      const source = await VehicleSource.findById(this.source);

      // If source exists and is NOT external, driver is required
      if (source && !source.isExternal && !this.driver) {
        this.invalidate(
          "driver",
          "Driver is required for internal vehicle sources",
        );
      }

      // If driver is provided, validate it's an employee
      if (this.driver) {
        const User = mongoose.model("User");
        const user = await User.findById(this.driver);

        if (!user || user.type !== "employee") {
          this.invalidate(
            "driver",
            'Driver must be a user with type "employee"',
          );
        }
      }
    }
    next();
  } catch (error) {
    next(error);
  }
});

vehicleSchema.index(
  { plateNormalized: 1 },
  {
    unique: true,
    partialFilterExpression: { plateNormalized: { $type: "string" } },
  },
);
vehicleSchema.index({ prestataire: 1, status: 1, plateNormalized: 1 });
vehicleSchema.index(
  { "externalIds.odoo": 1 },
  {
    unique: true,
    partialFilterExpression: { "externalIds.odoo": { $exists: true } },
  },
);

vehicleSchema.virtual("deliveries", {
  ref: "Delivery",
  localField: "_id",
  foreignField: "vehicle",
});

const VehicleSchema = mongoose.model("Vehicle", vehicleSchema);

module.exports = VehicleSchema;
