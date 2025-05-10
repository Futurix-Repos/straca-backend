const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const deliverySchema = new Schema(
  {
    reference: {
      type: String,
      required: true,
      unique: true,
    },
    departureAddress: {
      type: Schema.Types.ObjectId,
      ref: "Location",
      required: true,
    },
    destination: {
      type: Schema.Types.ObjectId,
      ref: "Address",
      required: true,
      validate: {
        validator: async function (destinationId) {
          // Check if the destination is in the order's destinations
          const Order = mongoose.model("Order");
          const order = await Order.findById(this.order);

          if (!order) {
            throw new Error("Associated order not found");
          }

          // Check if the destination is in the order's destinations array
          const isValidDestination = order.destinations.some(
            (dest) => dest.toString() === destinationId.toString(),
          );

          if (!isValidDestination) {
            throw new Error(
              "Destination must be one of the destinations in the associated order",
            );
          }

          return true;
        },
        message: "Invalid destination for this order",
      },
    },
    vehicle: {
      type: Schema.Types.ObjectId,
      ref: "Vehicle",
      required: true,
    },
    order: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    productMeasureUnit: {
      type: Schema.Types.ObjectId,
      ref: "ProductMeasureUnit",
      required: true,
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
  },
  {
    timestamps: true,
  },
);

const Delivery = mongoose.model("Delivery", deliverySchema);

module.exports = Delivery;
