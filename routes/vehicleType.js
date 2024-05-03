const express = require("express");
const router = express.Router();
const VehicleType = require("../models/vehicleTypeModel");

const mongoose = require("mongoose");
const { authorizeJwt, verifyAccount } = require("../helpers/verifyAccount");

// GET /vehicleTypes - Get all VehicleTypes
router.get(
  "/",
  authorizeJwt,
  verifyAccount([{ name: "vehicleType", action: "read" }]),
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
      const vehicleType = await VehicleType.find(filter);
      res.status(200).json(vehicleType);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: error.message });
    }
  }
);

// GET /vehicleTypes/:id - Get a specific vehicleTypes by ID
router.get(
  "/:id",
  authorizeJwt,
  verifyAccount([{ name: "vehicleType", action: "read" }]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const vehicleType = await VehicleType.findById(id);

      if (!vehicleType) {
        return res
          .status(404)
          .json({ message: `vehicleType with ID ${id} not found` });
      }

      res.status(200).json(vehicleType);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: error.message });
    }
  }
);

// POST /vehicleType - Create a new vehicleType
router.post(
  "/",
  authorizeJwt,
  verifyAccount([{ name: "vehicleType", action: "create" }]),
  async (req, res) => {
    try {
      // Generate a new ObjectId for the _id field
      const newId = new mongoose.Types.ObjectId();

      // Assign the generated _id to req.body
      req.body._id = newId;

      const vehicleType = await VehicleType.create(req.body);
      res.status(201).json(vehicleType);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: error.message });
    }
  }
);

// PUT /vehicleType/:id - Update a vehicleType by ID
router.put(
  "/:id",
  authorizeJwt,
  verifyAccount([{ name: "vehicleType", action: "update" }]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const vehicleType = await VehicleType.findByIdAndUpdate(id, req.body, {
        new: true,
      });

      if (!vehicleType) {
        return res
          .status(404)
          .json({ message: `Cannot find any vehicleType with ID ${id}` });
      }

      res.status(200).json(vehicleType);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: error.message });
    }
  }
);

// DELETE /vehicleType/:id - Delete a vehicleType by ID
router.delete(
  "/:id",
  authorizeJwt,
  verifyAccount([{ name: "vehicleType", action: "delete" }]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const vehicleType = await VehicleType.findByIdAndDelete(id);

      if (!vehicleType) {
        return res
          .status(404)
          .json({ message: `Cannot find any VehicleType with ID ${id}` });
      }

      res.status(200).json(vehicleType);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: error.message });
    }
  }
);

module.exports = router;
