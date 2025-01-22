const mongoose = require("mongoose");

const vehicleSchema = new mongoose.Schema(
  {
    _id: mongoose.Schema.Types.ObjectId,
    name: {
      type: String,
      required: true,
    },
    registrationNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    trackingId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
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
      required: true,
      validate: {
        validator: async function (value) {
          const User = mongoose.model("User");
          const user = await User.findById(value);
          return user && user.type === "employee";
        },
        message: 'Driver must be a user with type "employee"',
      },
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
  },
  {
    timestamps: true,
  },
);

const VehicleSchema = mongoose.model("Vehicle", vehicleSchema);

module.exports = VehicleSchema;
