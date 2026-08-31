const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const deliverySchema = new Schema(
  {
    reference: {
      type: String,
      required: true,
      unique: true,
    },
    startedAt: { type: Date, default: Date.now },
    departureChantier: {
      type: Schema.Types.ObjectId,
      ref: "Location",
      required: true,
    },
    departureSection: {
      type: Schema.Types.ObjectId,
      ref: "Section",
    },
    destination: {
      type: Schema.Types.ObjectId,
      ref: "Address",
      validate: {
        validator: async function (destinationId) {
          if (!destinationId) return true;
          if (!this.order) return true;

          const Order = mongoose.model("Order");
          const order = await Order.findById(this.order);
          if (!order) return true;

          return order.destinations.some(
            (dest) => dest.toString() === destinationId.toString(),
          );
        },
        message: "Invalid destination for this order",
      },
    },
    destinationCarriere: {
      type: Schema.Types.ObjectId,
      ref: "Location",
    },
    vehicle: {
      type: Schema.Types.ObjectId,
      ref: "Vehicle",
      required: true,
    },
    order: {
      type: Schema.Types.ObjectId,
      ref: "Order",
    },
    productMeasureUnit: {
      type: Schema.Types.ObjectId,
      ref: "ProductMeasureUnit",
      required: true,
    },
    prestataire: {
      type: Schema.Types.ObjectId,
      ref: "Prestataire",
      default: null,
    },
    sender: {
      user: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
        validate: {
          validator: async function (userId) {
            const User = mongoose.model("User");
            const user = await User.findById(userId);
            return user && (user.type === "admin" || user.type === "employee");
          },
          message: "Sender must be an admin or employee",
        },
      },
      quantity: {
        type: Number,
        required: true,
      },
      note: {
        type: String,
        trim: true,
      },
      validate: {
        type: Boolean,
        default: false,
      },
      validateBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
    },
    receiver: {
      user: {
        type: Schema.Types.ObjectId,
        ref: "User",
        validate: {
          validator: async function (userId) {
            const User = mongoose.model("User");
            const user = await User.findById(userId);
            return user && (user.type === "admin" || user.type === "employee");
          },
          message: "Sender must be an admin or employee",
        },
      },
      quantity: {
        type: Number,
      },
      note: {
        type: String,
      },
      proof: {
        type: String,
      },
      proofs: {
        type: [String],
        default: [],
      },
      signature: {
        type: String,
      },
      receiverSignature: {
        type: String,
      },
      clientRepresentativeSignature: {
        type: String,
      },
      receivedAt: {
        type: Date,
      },
      validate: {
        type: Boolean,
        default: false,
      },
      validateBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
    },
    status: {
      type: String,
      enum: ["PENDING", "DELIVERED", "CANCELED", "IN_PROGRESS"],
      default: "PENDING",
    },
    adminValidation: {
      status: {
        type: String,
        enum: ["NOT_REQUIRED", "PENDING", "APPROVED", "DISPUTED"],
        default: "NOT_REQUIRED",
      },
      validatedBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      validatedAt: { type: Date, default: null },
      note: { type: String, trim: true, default: null },
    },
    replacementDriver: {
      type: Schema.Types.ObjectId,
      ref: "User",
      validate: {
        validator: async function (userId) {
          if (!userId) return true;

          const Vehicle = mongoose.model("Vehicle");
          const vehicle = await Vehicle.findById(this.vehicle).populate({
            path: "source",
            select: "isExternal",
          });

          if (!vehicle) {
            return false;
          }

          if (vehicle.source && vehicle.source.isExternal === true) {
            return false;
          }

          const User = mongoose.model("User");
          const user = await User.findById(userId);
          return user && (user.type === "admin" || user.type === "employee");
        },
        message:
          "Replacement driver can only be set for non-external vehicles and must be an admin or employee",
      },
    },
    canceled: {
      isCanceled: { type: Boolean, default: false },
      reason: { type: String },
      canceledAt: { type: Date },
      canceledBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        validate: {
          validator: async function (userId) {
            const User = mongoose.model("User");
            const user = await User.findById(userId);
            return user && (user.type === "admin" || user.type === "employee");
          },
          message: "Sender must be an admin or employee",
        },
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

deliverySchema.pre("validate", function (next) {
  const hasOrder = !!this.order;
  const hasDestination = !!this.destination;
  const hasCarriere = !!this.destinationCarriere;

  if (hasCarriere && hasDestination) {
    return next(new Error("Une livraison ne peut pas avoir les deux destinations à la fois"));
  }
  if (!hasCarriere && !hasDestination) {
    return next(new Error("Une destination (adresse ou carrière) est requise"));
  }
  if (hasOrder && !hasDestination) {
    return next(new Error("Une adresse de destination est requise pour une livraison avec commande"));
  }
  if (!hasOrder && !hasCarriere) {
    return next(new Error("Une carrière de destination est requise pour une livraison sans commande"));
  }
  next();
});

deliverySchema.virtual("transfers", {
  ref: "DeliveryTransfer",
  localField: "_id",
  foreignField: "delivery",
});

const Delivery = mongoose.model("Delivery", deliverySchema);

module.exports = Delivery;
