const express = require("express");
const router = express.Router();
const VehicleBrand = require("../models/vehicleBrandModel");

const mongoose = require("mongoose");
const { authorizeJwt, verifyAccount } = require("../helpers/verifyAccount");

// GET /vehicleBrands - Get all VehicleBrands
router.get(
  "/",
  authorizeJwt,
  verifyAccount([{ name: "vehicleBrand", action: "read" }]),
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
      const vehicleBrand = await VehicleBrand.find(filter);
      res.status(200).json(vehicleBrand);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: error.message });
    }
  }
);

// GET /vehicleBrands/:id - Get a specific vehicleBrands by ID
router.get(
  "/:id",
  authorizeJwt,
  verifyAccount([{ name: "vehicleBrand", action: "read" }]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const vehicleBrand = await VehicleBrand.findById(id);

      if (!vehicleBrand) {
        return res
          .status(404)
          .json({ message: `vehicleBrand with ID ${id} not found` });
      }

      res.status(200).json(vehicleBrand);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: error.message });
    }
  }
);

// POST /vehicleBrand - Create a new vehicleBrand
router.post(
  "/",
  authorizeJwt,
  verifyAccount([{ name: "vehicleBrand", action: "create" }]),
  async (req, res) => {
    try {
      // Generate a new ObjectId for the _id field
      const newId = new mongoose.Types.ObjectId();

      // Assign the generated _id to req.body
      req.body._id = newId;

      const vehicleBrand = await VehicleBrand.create(req.body);
      res.status(201).json(vehicleBrand);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: error.message });
    }
  }
);

// PUT /vehicleBrand/:id - Update a vehicleBrand by ID
router.put(
  "/:id",
  authorizeJwt,
  verifyAccount([{ name: "vehicleBrand", action: "update" }]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const vehicleBrand = await VehicleBrand.findByIdAndUpdate(id, req.body, {
        new: true,
      });

      if (!vehicleBrand) {
        return res
          .status(404)
          .json({ message: `Cannot find any vehicleBrand with ID ${id}` });
      }

      res.status(200).json(vehicleBrand);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: error.message });
    }
  }
);

// DELETE /vehicleBrand/:id - Delete a vehicleBrand by ID
router.delete(
  "/:id",
  authorizeJwt,
  verifyAccount([{ name: "vehicleBrand", action: "delete" }]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const vehicleBrand = await VehicleBrand.findByIdAndDelete(id);

      if (!vehicleBrand) {
        return res
          .status(404)
          .json({ message: `Cannot find any VehicleBrand with ID ${id}` });
      }

      res.status(200).json(vehicleBrand);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: error.message });
    }
  }
);

module.exports = router;
