const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Section = require("../models/sectionModel");
const { authorizeJwt, verifyAccount } = require("../helpers/verifyAccount");
const { paginationFromQuery } = require("../services/vehicleReference");

// GET /sections?chantierId=xxx&search=yyy
router.get(
  "/",
  authorizeJwt,
  verifyAccount([{ name: "location", action: "read" }]),
  async (req, res) => {
    try {
      const filter = {};
      const { chantierId, search } = req.query;

      if (chantierId) filter.chantier = chantierId;

      if (search) {
        filter.$or = [
          { label: { $regex: search, $options: "i" } },
          { description: { $regex: search, $options: "i" } },
        ];
      }

      const query = Section.find(filter).populate("chantier", "label description").sort({ label: 1 });
      if (req.query.page || req.query.perPage) {
        const { limit, page, skip } = paginationFromQuery(req.query);
        const [items, total] = await Promise.all([
          query.skip(skip).limit(limit),
          Section.countDocuments(filter),
        ]);
        return res.status(200).json({ items, page, perPage: limit, total });
      }
      const sections = await query;
      res.status(200).json(sections);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },
);

// GET /sections/:id
router.get(
  "/:id",
  authorizeJwt,
  verifyAccount([{ name: "location", action: "read" }]),
  async (req, res) => {
    try {
      const section = await Section.findById(req.params.id).populate(
        "chantier",
        "label description",
      );
      if (!section)
        return res.status(404).json({ message: "Section introuvable" });
      res.status(200).json(section);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },
);

// POST /sections
router.post(
  "/",
  authorizeJwt,
  verifyAccount([{ name: "location", action: "create" }]),
  async (req, res) => {
    try {
      const { label, description, chantier } = req.body;
      const section = await Section.create({
        _id: new mongoose.Types.ObjectId(),
        label,
        description,
        chantier,
      });
      const populated = await Section.findById(section._id).populate(
        "chantier",
        "label description",
      );
      res.status(201).json(populated);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },
);

// PUT /sections/:id
router.put(
  "/:id",
  authorizeJwt,
  verifyAccount([{ name: "location", action: "update" }]),
  async (req, res) => {
    try {
      const section = await Section.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true },
      ).populate("chantier", "label description");

      if (!section)
        return res.status(404).json({ message: "Section introuvable" });
      res.status(200).json(section);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },
);

// DELETE /sections/:id
router.delete(
  "/:id",
  authorizeJwt,
  verifyAccount([{ name: "location", action: "delete" }]),
  async (req, res) => {
    try {
      const section = await Section.findByIdAndDelete(req.params.id);
      if (!section)
        return res.status(404).json({ message: "Section introuvable" });
      res.status(200).json(section);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },
);

module.exports = router;
