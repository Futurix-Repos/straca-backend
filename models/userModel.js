const mongoose = require("mongoose");

const validUserTypes = ["admin", "employee", "client"];

const userSchema = mongoose.Schema(
  {
    _id: mongoose.Schema.Types.ObjectId,
    firstName: {
      type: String,
      required: function () {
        return this.type !== "admin";
      },
    },
    lastName: {
      type: String,
      required: function () {
        return this.type !== "admin";
      },
    },
    phone: {
      type: String,
      required: function () {
        return this.type !== "admin";
      },
    },
    address: {
      type: String,
    },
    title: {
      type: String,
      required: function () {
        return this.type !== "admin" && this.type !== "client";
      },
    },
    company: {
      type: String,
    },
    type: {
      type: String,
      required: true,
      validate: {
        validator: function (value) {
          return validUserTypes.includes(value);
        },
        message: "Type must be either admin, employee, or client",
      },
    },
    email: {
      type: String,
      required: true,
      unique: true,
      match:
        /[a-z0-9!#$%'*+/=?^_`{|}~-]+(?:\.[a-z09!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/,
    },
    password: { type: String, required: true },
    permissions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Permission",
      },
    ],
    confirmed: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  },
);

userSchema.virtual("createdBlogs", {
  ref: "Blog",
  localField: "_id",
  foreignField: "createdBy",
});

userSchema.virtual("vehicles", {
  ref: "Vehicle",
  localField: "_id",
  foreignField: "driver",
});

userSchema.virtual("createdVehicles", {
  ref: "Vehicle",
  localField: "_id",
  foreignField: "createdBy",
});

module.exports = mongoose.model("User", userSchema);
