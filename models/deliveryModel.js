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
  },
  {
    timestamps: true,
  },
);

const Delivery = mongoose.model("Delivery", deliverySchema);

module.exports = Delivery;
