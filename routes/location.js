const express = require("express");
const router = express.Router();
const Location = require("../models/locationModel");

const mongoose = require("mongoose");
const { authorizeJwt, verifyAccount } = require("../helpers/verifyAccount");

// GET /locations - Get all Locations
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
      const location = await Location.find(filter);
      res.status(200).json(location);
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

// DELETE /location/:id - Delete a location by ID
router.delete(
  "/:id",
  authorizeJwt,
  verifyAccount([{ name: "location", action: "delete" }]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const location = await Location.findByIdAndDelete(id);

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
