const mongoose = require("mongoose");

const receptionDraftSchema = new mongoose.Schema(
  {
    voucherNumber: { type: String, required: true, trim: true },
    qrPayload: { type: String, required: true },
    qrPayloadHash: { type: String, required: true, trim: true },
    receiverEmployeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    quantity: { type: Number, required: true },
    note: { type: String, default: "", trim: true },
    proofs: { type: [String], required: true, validate: [(proofs) => proofs.length >= 1 && proofs.length <= 5, "Entre 1 et 5 preuves sont requises."] },
    clientRequestId: { type: String, required: true, unique: true, trim: true },
    status: {
      type: String,
      enum: ["pending_sender", "reconciled"],
      default: "pending_sender",
      index: true,
    },
    reconciledAt: { type: Date, default: null },
    deliveryId: { type: mongoose.Schema.Types.ObjectId, ref: "Delivery", default: null },
  },
  { timestamps: true },
);

receptionDraftSchema.index({ voucherNumber: 1, status: 1 });

module.exports = mongoose.model("ReceptionDraft", receptionDraftSchema);
