const express = require("express");
const router = express.Router();
const Location = require("../models/locationModel");
const Section = require("../models/sectionModel");

const mongoose = require("mongoose");
const { authorizeJwt, verifyAccount } = require("../helpers/verifyAccount");

// GET /locations - Get all Locations with their sections
router.get(
  "/",
  authorizeJwt,
  verifyAccount([{ name: "location", action: "read" }]),
  async (req, res) => {
    const filter = {};
    const search = req.query.search;

    if (search) {
      filter.$or = [
        { label: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    try {
      const locations = await Location.find(filter).sort({ label: 1 });

      const locationIds = locations.map((l) => l._id);
      const sections = await Section.find({
        chantier: { $in: locationIds },
      }).sort({ label: 1 });

      const result = locations.map((loc) => ({
        ...loc.toJSON(),
        sections: sections
          .filter((s) => s.chantier.toString() === loc._id.toString())
          .map((s) => s.toJSON()),
      }));

      res.status(200).json(result);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: error.message });
    }
  },
);

// GET /locations/:id - Get a specific locations by ID
router.get(
  "/:id",
  authorizeJwt,
  verifyAccount([{ name: "location", action: "read" }]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const location = await Location.findById(id);

      if (!location) {
        return res
          .status(404)
          .json({ message: `location with ID ${id} not found` });
      }

      res.status(200).json(location);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: error.message });
    }
  },
);

// POST /location - Create a new location
router.post(
  "/",
  authorizeJwt,
  verifyAccount([{ name: "location", action: "create" }]),
  async (req, res) => {
    try {
      // Generate a new ObjectId for the _id field
      const newId = new mongoose.Types.ObjectId();

      // Assign the generated _id to req.body
      req.body._id = newId;

      const location = await Location.create(req.body);
      res.status(201).json(location);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: error.message });
    }
  },
);

// PUT /location/:id - Update a location by ID
router.put(
  "/:id",
  authorizeJwt,
  verifyAccount([{ name: "location", action: "update" }]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const location = await Location.findByIdAndUpdate(id, req.body, {
        new: true,
      });

      if (!location) {
        return res
          .status(404)
          .json({ message: `Cannot find any location with ID ${id}` });
      }

      res.status(200).json(location);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: error.message });
    }
  },
);

router.patch(
  "/:id",
  authorizeJwt,
  verifyAccount([{ name: "location", action: "update" }]),
  async (req, res) => {
    try {
      const location = await Location.findByIdAndUpdate(
        req.params.id,
        { $set: req.body },
        { new: true, runValidators: true },
      );
      if (!location) return res.status(404).json({ message: "Site introuvable" });
      return res.status(200).json(location);
    } catch (error) {
      if (error.code === 11000) return res.status(409).json({ message: "Code ou identifiant externe déjà utilisé." });
      return res.status(400).json({ message: error.message });
    }
  },
);

// DELETE /location/:id - Delete a location by ID
router.delete(
  "/:id",
  authorizeJwt,
  verifyAccount([{ name: "location", action: "delete" }]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const location = await Location.findByIdAndUpdate(
        id,
        { isActive: false },
        { new: true, runValidators: true },
      );

      if (!location) {
        return res
          .status(404)
          .json({ message: `Cannot find any Location with ID ${id}` });
      }

      res.status(200).json(location);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: error.message });
    }
  },
);

module.exports = router;
