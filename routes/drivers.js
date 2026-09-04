const express = require("express");
const mongoose = require("mongoose");
const Driver = require("../models/driverModel");
const { authorizeJwt, verifyAccount } = require("../helpers/verifyAccount");
const { normalizeDriverKey } = require("../helpers/referenceNormalization");
const { isDuplicateKeyError, paginationFromQuery } = require("../services/vehicleReference");

const router = express.Router();
const driverPermissions = [{ name: "vehicle", action: "read" }];

router.get("/", authorizeJwt, verifyAccount(driverPermissions), async (req, res) => {
  try {
    const { q } = req.query;
    const filter = q
      ? { $or: [{ nameKey: { $regex: normalizeDriverKey(q), $options: "i" } }, { fullName: { $regex: q, $options: "i" } }] }
      : {};
    const { limit, page, skip } = paginationFromQuery(req.query);
    const [items, total] = await Promise.all([
      Driver.find(filter).sort({ fullName: 1 }).skip(skip).limit(limit),
      Driver.countDocuments(filter),
    ]);
    res.status(200).json({ items, page, perPage: limit, total });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/", authorizeJwt, verifyAccount([{ name: "vehicle", action: "create" }]), async (req, res) => {
  try {
    const nameKey = normalizeDriverKey(req.body.fullName);
    const driver = await Driver.findOneAndUpdate(
      { nameKey },
      { $setOnInsert: { _id: new mongoose.Types.ObjectId(), fullName: req.body.fullName, nameKey, user: req.body.user || null } },
      { upsert: true, new: true, runValidators: true },
    );
    res.status(201).json(driver);
  } catch (error) {
    if (isDuplicateKeyError(error)) return res.status(409).json({ message: "Ce chauffeur existe déjà." });
    res.status(400).json({ message: error.message });
  }
});

router.patch("/:id", authorizeJwt, verifyAccount([{ name: "vehicle", action: "update" }]), async (req, res) => {
  try {
    const payload = { ...req.body };
    if (payload.fullName) payload.nameKey = normalizeDriverKey(payload.fullName);
    const driver = await Driver.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true });
    if (!driver) return res.status(404).json({ message: "Chauffeur introuvable" });
    return res.status(200).json(driver);
  } catch (error) {
    if (isDuplicateKeyError(error)) return res.status(409).json({ message: "Ce chauffeur existe déjà." });
    return res.status(400).json({ message: error.message });
  }
});

module.exports = router;
