const express = require("express");
const router = express.Router();
const VehicleSource = require("../models/vehicleSourceModel");

const mongoose = require("mongoose");
const { authorizeJwt, verifyAccount } = require("../helpers/verifyAccount");

// GET /vehicleSource - Get all vehicleSources
router.get(
  "/",
  authorizeJwt,
  verifyAccount([{ name: "vehicleSource", action: "read" }]),
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
      const vehicleSources = await VehicleSource.find(filter);
      res.status(200).json(vehicleSources);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: error.message });
    }
  },
);

// GET /vehicleSource/:id - Get a specific vehicleSource by ID
router.get(
  "/:id",
  authorizeJwt,
  verifyAccount([{ name: "vehicleSource", action: "read" }]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const vehicleSource = await VehicleSource.findById(id);

      if (!vehicleSource) {
        return res
          .status(404)
          .json({ message: `vehicleSource with ID ${id} not found` });
      }

      res.status(200).json(vehicleSource);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: error.message });
    }
  },
);

// POST /vehicleSource - Create a new vehicleSource
router.post(
  "/",
  authorizeJwt,
  verifyAccount([{ name: "vehicleSource", action: "create" }]),
  async (req, res) => {
    try {
      // Generate a new ObjectId for the _id field
      const newId = new mongoose.Types.ObjectId();

      // Assign the generated _id to req.body
      req.body._id = newId;

      const vehicleSource = await VehicleSource.create(req.body);
      res.status(201).json(vehicleSource);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: error.message });
    }
  },
);

// PUT /vehicleSource/:id - Update a vehicleSource by ID
router.put(
  "/:id",
  authorizeJwt,
  verifyAccount([{ name: "vehicleSource", action: "update" }]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const vehicleSource = await VehicleSource.findByIdAndUpdate(
        id,
        req.body,
        {
          new: true,
        },
      );

      if (!vehicleSource) {
        return res
          .status(404)
          .json({ message: `Cannot find any vehicleSource with ID ${id}` });
      }

      res.status(200).json(vehicleSource);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: error.message });
    }
  },
);

// DELETE /vehicleSource/:id - Delete a vehicleSource by ID
router.delete(
  "/:id",
  authorizeJwt,
  verifyAccount([{ name: "vehicleSource", action: "delete" }]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const vehicleSource = await VehicleSource.findByIdAndDelete(id);

      if (!vehicleSource) {
        return res
          .status(404)
          .json({ message: `Cannot find any vehicleSource with ID ${id}` });
      }

      res.status(200).json(vehicleSource);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: error.message });
    }
  },
);

module.exports = router;
