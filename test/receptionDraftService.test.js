const assert = require("node:assert/strict");
const test = require("node:test");

const {
  receiverEvidenceFromProofs,
  receptionDraftResponse,
  replayReceptionResponse,
  validateReceptionRequest,
} = require("../services/receptionDraftService");

test("builds receiver evidence from every uploaded proof", () => {
  const evidence = receiverEvidenceFromProofs([
    "https://cdn.example/proof-1.jpg",
    "https://cdn.example/proof-2.jpg",
  ]);

  assert.deepEqual(evidence, {
    proof: "https://cdn.example/proof-1.jpg",
    proofs: [
      "https://cdn.example/proof-1.jpg",
      "https://cdn.example/proof-2.jpg",
    ],
    receiverSignature: "",
    clientRepresentativeSignature: "",
  });
});

test("returns the stable accepted response for an existing reception draft", () => {
  const response = receptionDraftResponse({
    _id: "reception_draft_123",
    voucherNumber: "BL-2026-0042",
  });

  assert.deepEqual(response, {
    status: "pending_sender",
    receptionDraftId: "reception_draft_123",
    voucherNumber: "BL-2026-0042",
  });
});

test("accepts a request whose hash matches the canonical QR JSON", () => {
  const result = validateReceptionRequest({
    quantity: "25",
    note: "RAS",
    qrPayload: '{"voucherNumber":"BL-2026-0042","quantity":25}',
    qrPayloadHash: "sha256:16a5453a6bd09b448eb5ff2a0e1f505519d0bbbfcf2c4b6e9a6592e423407934",
    clientRequestId: "2f6dbdf7-8749-42cc-a044-236a91fb2ebc",
    proofCount: 1,
  });

  assert.deepEqual(result, { valid: true });
});

test("accepts a reception without QR when the delivery already exists", () => {
  const result = validateReceptionRequest({
    quantity: "25",
    clientRequestId: "2f6dbdf7-8749-42cc-a044-236a91fb2ebc",
    proofCount: 1,
    requireQrPayload: false,
  });

  assert.deepEqual(result, { valid: true });
});

test("replays a reconciled draft as the final received response", () => {
  const replay = replayReceptionResponse({
    _id: "reception_draft_123",
    voucherNumber: "BL-2026-0042",
    status: "reconciled",
    deliveryId: "delivery_123",
  });

  assert.deepEqual(replay, {
    statusCode: 200,
    body: {
      status: "received",
      deliveryId: "delivery_123",
      voucherNumber: "BL-2026-0042",
    },
  });
});
