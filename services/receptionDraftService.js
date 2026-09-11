const crypto = require("crypto");

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function canonicalizeJson(value) {
  if (Array.isArray(value)) return value.map(canonicalizeJson);
  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((canonical, key) => {
        canonical[key] = canonicalizeJson(value[key]);
        return canonical;
      }, {});
  }
  return value;
}

function validateReceptionRequest({
  quantity,
  qrPayload,
  qrPayloadHash,
  clientRequestId,
  proofCount,
  requireQrPayload = true,
}) {
  if (!Number.isFinite(Number(quantity))) {
    return { valid: false, message: "quantity doit être un nombre." };
  }
  if (!Number.isInteger(proofCount) || proofCount < 1 || proofCount > 5) {
    return { valid: false, message: "Entre 1 et 5 photos sont requises." };
  }
  if (!UUID_PATTERN.test(clientRequestId || "")) {
    return { valid: false, message: "clientRequestId doit être un UUID valide." };
  }

  if (!requireQrPayload && !qrPayload && !qrPayloadHash) {
    return { valid: true };
  }

  let parsedPayload;
  try {
    parsedPayload = JSON.parse(qrPayload);
  } catch {
    return { valid: false, message: "qrPayload doit être un JSON valide." };
  }

  const expectedHash = crypto
    .createHash("sha256")
    .update(JSON.stringify(canonicalizeJson(parsedPayload)))
    .digest("hex");
  if (qrPayloadHash?.replace(/^sha256:/i, "").toLowerCase() !== expectedHash) {
    return { valid: false, message: "qrPayloadHash ne correspond pas au QR." };
  }

  return { valid: true };
}

function receiverEvidenceFromProofs(proofs) {
  return {
    proof: proofs[0],
    proofs,
    receiverSignature: "",
    clientRepresentativeSignature: "",
  };
}

function receptionDraftResponse(draft) {
  return {
    status: "pending_sender",
    receptionDraftId: draft._id.toString(),
    voucherNumber: draft.voucherNumber,
  };
}

function receivedDeliveryResponse(delivery) {
  return {
    status: "received",
    deliveryId: delivery._id.toString(),
    voucherNumber: delivery.voucherNumber,
  };
}

function replayReceptionResponse(draft) {
  if (draft.status === "reconciled" && draft.deliveryId) {
    return { statusCode: 200, body: receivedDeliveryResponse({ _id: draft.deliveryId, voucherNumber: draft.voucherNumber }) };
  }

  return { statusCode: 202, body: receptionDraftResponse(draft) };
}

module.exports = {
  receiverEvidenceFromProofs,
  receptionDraftResponse,
  receivedDeliveryResponse,
  replayReceptionResponse,
  validateReceptionRequest,
};
