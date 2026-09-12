const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Prestataire = require("../models/prestataireModel");
const { authorizeJwt, verifyAccount } = require("../helpers/verifyAccount");
const { paginationFromQuery } = require("../services/vehicleReference");

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

      const query = Prestataire.find(filter).sort({ name: 1 });
      if (req.query.page || req.query.perPage) {
        const { limit, page, skip } = paginationFromQuery(req.query);
        const [items, total] = await Promise.all([
          query.skip(skip).limit(limit),
          Prestataire.countDocuments(filter),
        ]);
        return res.status(200).json({ items, page, perPage: limit, total });
      }
      const prestataires = await query;
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

router.patch(
  "/:id",
  authorizeJwt,
  verifyAccount([{ name: "prestataire", action: "update" }]),
  async (req, res) => {
    try {
      const prestataire = await Prestataire.findByIdAndUpdate(
        req.params.id,
        { $set: req.body },
        { new: true, runValidators: true },
      );
      if (!prestataire) return res.status(404).json({ message: "Prestataire introuvable" });
      return res.status(200).json(prestataire);
    } catch (error) {
      if (error.code === 11000) return res.status(409).json({ message: "Identifiant externe déjà utilisé." });
      return res.status(400).json({ message: error.message });
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
      const prestataire = await Prestataire.findByIdAndUpdate(
        req.params.id,
        { isActive: false },
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

module.exports = router;
