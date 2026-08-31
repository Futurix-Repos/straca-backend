const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Prestataire = require("../models/prestataireModel");
const { authorizeJwt, verifyAccount } = require("../helpers/verifyAccount");

// GET /prestataires?search=&type=&isActive=true|false
router.get(
  "/",
  authorizeJwt,
  verifyAccount([{ name: "prestataire", action: "read" }]),
  async (req, res) => {
    try {
      const filter = {};
      const { search, type, isActive } = req.query;

      if (type) filter.type = type;
      if (isActive !== undefined) filter.isActive = isActive === "true";

      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
          { phone: { $regex: search, $options: "i" } },
          { ifu: { $regex: search, $options: "i" } },
          { rccm: { $regex: search, $options: "i" } },
          { zone: { $regex: search, $options: "i" } },
          { address: { $regex: search, $options: "i" } },
        ];
      }

      const prestataires = await Prestataire.find(filter).sort({ name: 1 });
      res.status(200).json(prestataires);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: error.message });
    }
  },
);

// GET /prestataires/:id
router.get(
  "/:id",
  authorizeJwt,
  verifyAccount([{ name: "prestataire", action: "read" }]),
  async (req, res) => {
    try {
      const prestataire = await Prestataire.findById(req.params.id);
      if (!prestataire) {
        return res.status(404).json({ message: "Prestataire introuvable" });
      }
      res.status(200).json(prestataire);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: error.message });
    }
  },
);

// POST /prestataires
router.post(
  "/",
  authorizeJwt,
  verifyAccount([{ name: "prestataire", action: "create" }]),
  async (req, res) => {
    try {
      const newId = new mongoose.Types.ObjectId();
      const prestataire = await Prestataire.create({ _id: newId, ...req.body });
      res.status(201).json(prestataire);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: error.message });
    }
  },
);

// PUT /prestataires/:id
router.put(
  "/:id",
  authorizeJwt,
  verifyAccount([{ name: "prestataire", action: "update" }]),
  async (req, res) => {
    try {
      const prestataire = await Prestataire.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true, runValidators: true },
      );
      if (!prestataire) {
        return res.status(404).json({ message: "Prestataire introuvable" });
      }
      res.status(200).json(prestataire);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: error.message });
    }
  },
);

// DELETE /prestataires/:id
router.delete(
  "/:id",
  authorizeJwt,
  verifyAccount([{ name: "prestataire", action: "delete" }]),
  async (req, res) => {
    try {
      const prestataire = await Prestataire.findByIdAndDelete(req.params.id);
      if (!prestataire) {
        return res.status(404).json({ message: "Prestataire introuvable" });
      }
      res.status(200).json(prestataire);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: error.message });
    }
  },
);

module.exports = router;
