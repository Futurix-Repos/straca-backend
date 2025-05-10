const mongoose = require("mongoose");

const locationSchema = new mongoose.Schema({
  lat: {
    type: Number,
    required: true,
  },
  lng: {
    type: Number,
    required: true,
  },
});

const addressSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      trim: true,
    },
    location: {
      type: locationSchema,
      required: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      validate: {
        validator: async function (userId) {
          const User = mongoose.model("User");
          const user = await User.findById(userId);
          return !!user;
        },
        message: "Owner must be a valid user",
      },
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

// Add a unique compound index for name and owner
// This ensures each user can only have one address with a specific name
addressSchema.index({ name: 1, owner: 1 }, { unique: true });

// Regular index for querying addresses by owner
addressSchema.index({ owner: 1 });

const Address = mongoose.model("Address", addressSchema);

module.exports = Address;
