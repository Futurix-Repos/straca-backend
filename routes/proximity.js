const express = require("express");
const router = express.Router();

const mongoose = require("mongoose");
const { authorizeJwt, verifyAccount } = require("../helpers/verifyAccount");
const Proximity = require("../models/proximityModel");

// GET /proximityLists - Get all proximitiesLists
router.get(
  "/",
  authorizeJwt,
  verifyAccount([{ name: "Proximity", action: "read" }]),
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
      const proximity = await Proximity.find(filter);
      res.status(200).json(proximity);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: error.message });
    }
  }
);

// GET /proximityLists/:id - Get a specific proximityList by ID
router.get(
  "/:id",
  authorizeJwt,
  verifyAccount([{ name: "Proximity", action: "read" }]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const proximity = await Proximity.findById(id);

      if (!proximity) {
        return res
          .status(404)
          .json({ message: `Proximity with ID ${id} not found` });
      }

      res.status(200).json(proximity);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: error.message });
    }
  }
);

// POST /proximityList - Create a new proximityList
router.post(
  "/",
  authorizeJwt,
  verifyAccount([{ name: "Proximity", action: "create" }]),
  async (req, res) => {
    try {
      // Generate a new ObjectId for the _id field
      const newId = new mongoose.Types.ObjectId();

      // Assign the generated _id to req.body
      req.body._id = newId;

      const proximity = await Proximity.create(req.body);
      res.status(201).json(proximity);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: error.message });
    }
  }
);

// PUT /proximityList/:id - Update a proximityList by ID
router.put(
  "/:id",
  authorizeJwt,
  verifyAccount([{ name: "Proximity", action: "update" }]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const proximity = await Proximity.findByIdAndUpdate(id, req.body, {
        new: true,
      });

      if (!proximity) {
        return res
          .status(404)
          .json({ message: `Cannot find any proximityList with ID ${id}` });
      }

      res.status(200).json(proximity);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: error.message });
    }
  }
);

// DELETE /proximityList/:id - Delete a Proximity by ID
router.delete(
  "/:id",
  authorizeJwt,
  verifyAccount([{ name: "Proximity", action: "delete" }]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const proximity = await Proximity.findByIdAndDelete(id);

      if (!proximity) {
        return res
          .status(404)
          .json({ message: `Cannot find any Proximity with ID ${id}` });
      }

      res.status(200).json(proximity);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: error.message });
    }
  }
);

module.exports = router;
