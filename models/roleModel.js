const mongoose = require("mongoose");
const { ROLES } = require("../helpers/constants");

const roleSchema = mongoose.Schema(
  {
    _id: mongoose.Schema.Types.ObjectId,
    code: {
      type: String,
      required: true,
      unique: true,
      enum: Object.values(ROLES),
    },
    name: { type: String, required: true },
    description: { type: String },
    permissions: [{ type: mongoose.Schema.Types.ObjectId, ref: "Permission" }],
    active: { type: Boolean, default: true },
    isSystem: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Role", roleSchema);
