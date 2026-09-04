const mongoose = require("mongoose");
const { normalizeDriverKey } = require("../helpers/referenceNormalization");

const driverSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true, maxlength: 255 },
    nameKey: { type: String, required: true, unique: true, trim: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

driverSchema.pre("validate", function normalizeName(next) {
  if (this.fullName) {
    this.fullName = this.fullName.trim().replace(/\s+/g, " ");
    this.nameKey = normalizeDriverKey(this.fullName);
  }
  next();
});

module.exports = mongoose.model("Driver", driverSchema);
