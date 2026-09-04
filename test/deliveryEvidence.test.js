const assert = require("node:assert/strict");
const test = require("node:test");

const { skippedReceiverEvidence } = require("../services/deliveryEvidence");

test("returns empty receiver evidence without uploading submitted files", async () => {
  const evidence = await skippedReceiverEvidence([
    { originalname: "proof.jpg" },
  ]);

  assert.deepEqual(evidence, {
    proof: "",
    proofs: [],
    receiverSignature: "",
    clientRepresentativeSignature: "",
  });
});
