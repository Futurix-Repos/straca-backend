const mongoose = require("mongoose");

const locationSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

const LocationModel = mongoose.model("Location", locationSchema);

module.exports = LocationModel;
