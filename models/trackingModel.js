const mongoose = require("mongoose");

const trackingSchema = new mongoose.Schema(
  {
    _id: mongoose.Schema.Types.ObjectId,
    name: {
      type: String,
      required: true,
    },
    brand: {
      type: String,
      required: true,
    },
    registrationNumber: {
      type: String,
      required: false,
    },
    type: {
      type: String,
      required: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Commande',
      required: true, 
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
  },
  {
    timestamps: true,
  }
);

const TrackingSchema = mongoose.model("Tracking", trackingSchema);

module.exports = TrackingSchema;
