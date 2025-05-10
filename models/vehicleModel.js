const mongoose = require("mongoose");

const vehicleSchema = new mongoose.Schema(
  {
    _id: mongoose.Schema.Types.ObjectId,
    registrationNumber: {
      type: String,
      required: true,
      unique: true,
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

vehicleSchema.virtual("deliveries", {
  ref: "Delivery",
  localField: "_id",
  foreignField: "vehicle",
});

const VehicleSchema = mongoose.model("Vehicle", vehicleSchema);

module.exports = VehicleSchema;
