const mongoose = require("mongoose");

const deliveryTransferSchema = new mongoose.Schema(
  {
    delivery: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Delivery",
      required: true,
    },
    fromVehicle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vehicle",
      required: true,
    },
    toVehicle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vehicle",
      required: true,
    },
    transferredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    transferredAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

deliveryTransferSchema.pre("validate", async function (next) {
  const DeliveryTransfer = mongoose.model("DeliveryTransfer");
  const existingTransfers = await DeliveryTransfer.countDocuments({
    delivery: this.delivery,
  });

  if (existingTransfers >= 5) {
    return next(
      new Error("Une livraison ne peut pas être transférée plus de 5 fois."),
    );
  }

  next();
});

const DeliveryTransfer = mongoose.model(
  "DeliveryTransfer",
  deliveryTransferSchema,
);

module.exports = DeliveryTransfer;
