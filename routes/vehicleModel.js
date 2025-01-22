const express = require("express");
const router = express.Router();
const VehicleModel = require("../models/vehicleModelSchema");

const mongoose = require("mongoose");
const { authorizeJwt, verifyAccount } = require("../helpers/verifyAccount");

// GET /vehicleModels - Get all VehicleModels
router.get(
  "/",
  authorizeJwt,
  verifyAccount([{ name: "vehicleModel", action: "read" }]),
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
      const vehicleModel = await VehicleModel.find(filter).populate("brand");
      res.status(200).json(vehicleModel);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: error.message });
    }
  },
);

// GET /vehicleModels/:id - Get a specific vehicleModels by ID
router.get(
  "/:id",
  authorizeJwt,
  verifyAccount([{ name: "vehicleModel", action: "read" }]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const vehicleModel = await VehicleModel.findById(id).populate("brand");

      if (!vehicleModel) {
        return res
          .status(404)
          .json({ message: `vehicleModel with ID ${id} not found` });
      }

      res.status(200).json(vehicleModel);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: error.message });
    }
  },
);

// POST /vehicleModel - Create a new vehicleModel
router.post(
  "/",
  authorizeJwt,
  verifyAccount([{ name: "vehicleModel", action: "create" }]),
  async (req, res) => {
    try {
      // Generate a new ObjectId for the _id field
      const newId = new mongoose.Types.ObjectId();

      // Assign the generated _id to req.body
      req.body._id = newId;

      const vehicleModel = await VehicleModel.create(req.body);
      res.status(201).json(vehicleModel);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: error.message });
    }
  },
);

// PUT /vehicleModel/:id - Update a vehicleModel by ID
router.put(
  "/:id",
  authorizeJwt,
  verifyAccount([{ name: "vehicleModel", action: "update" }]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const vehicleModel = await VehicleModel.findByIdAndUpdate(id, req.body, {
        new: true,
      });

      if (!vehicleModel) {
        return res
          .status(404)
          .json({ message: `Cannot find any vehicleModel with ID ${id}` });
      }

      res.status(200).json(vehicleModel);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: error.message });
    }
  },
);

// DELETE /vehicleModel/:id - Delete a vehicleModel by ID
router.delete(
  "/:id",
  authorizeJwt,
  verifyAccount([{ name: "vehicleModel", action: "delete" }]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const vehicleModel = await VehicleModel.findByIdAndDelete(id);

      if (!vehicleModel) {
        return res
          .status(404)
          .json({ message: `Cannot find any VehicleModel with ID ${id}` });
      }

      res.status(200).json(vehicleModel);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: error.message });
    }
  },
);

module.exports = router;
