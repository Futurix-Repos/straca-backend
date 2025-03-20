const express = require("express");
const router = express.Router();
const Vehicle = require("../models/vehicleModel");

const mongoose = require("mongoose");
const { authorizeJwt, verifyAccount } = require("../helpers/verifyAccount");
const Delivery = require("../models/deliveryModel");

const populateArray = [
  {
    path: "model",
    select: "label",
    populate: {
      path: "brand",
      select: "label",
    },
  },
  {
    path: "type",
    select: "label",
  },
  {
    path: "source",
    select: "label",
  },
  {
    path: "driver",
    select: "firstName lastName email phone",
  },
  {
    path: "createdBy",
    select: "firstName lastName email phone",
  },
];

// GET /vehicle - Get all vehicles
router.get(
  "/",
  authorizeJwt,
  verifyAccount([{ name: "vehicle", action: "read" }]),
  async (req, res) => {
    const filter = {};
    const search = req.query.search;

    if (search) {
      filter.$or = [
        { editor: { $regex: search, $options: "i" } },
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    try {
      const vehicle = await Vehicle.find(filter).populate(populateArray);

      res.status(200).json(vehicle);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: error.message });
    }
  },
);

// POST /vehicle - Create a new vehicle
router.post(
  "/",
  authorizeJwt,
  verifyAccount([{ name: "vehicle", action: "create" }]),
  async (req, res) => {
    try {
      // Generate a new ObjectId for the _id field
      const newId = new mongoose.Types.ObjectId();

      // Assign the generated _id and imageUrl to req.body
      req.body._id = newId;

      // Create the vehicle with the provided data
      const vehicle = await Vehicle.create(req.body);
      res.status(201).json(vehicle);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: error.message });
    }
  },
);

// GET /vehicle/plate/:plate - Get a specific vehicle by ID
router.get(
  "/check-availability/:plate",
  authorizeJwt,
  verifyAccount([{ name: "vehicle", action: "read" }]),

  async (req, res) => {
    try {
      const { plate } = req.params;

      // First find the vehicle by registration number
      const vehicle = await Vehicle.findOne({
        registrationNumber: plate,
      }).populate(populateArray);

      if (!vehicle) {
        return res.status(404).json({
          success: false,
          message: "Vehicle not found",
        });
      }

      // If no pending deliveries found, vehicle is available
      res.status(200).json({
        success: true,
        message: "Vehicle is available",
        vehicle: vehicle,
      });
    } catch (error) {
      console.error("Error in checkVehicleAvailability:", error);
      res.status(500).json({
        success: false,
        message: "Error checking vehicle availability",
        error: error.message,
      });
    }
  },
);

// GET /vehicle/:id - Get a specific vehicle by ID
router.get(
  "/:id",
  authorizeJwt,
  verifyAccount([{ name: "vehicle", action: "read" }]),

  async (req, res) => {
    try {
      const { id } = req.params;
      const vehicle = await Vehicle.findById(id).populate([
        ...populateArray,
        {
          path: "deliveries",
        },
      ]);

      if (!vehicle) {
        return res
          .status(404)
          .json({ message: `Vehicle with ID ${id} not found` });
      }

      res.status(200).json(vehicle);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: error.message });
    }
  },
);

// PUT /vehicle/:id - Update a vehicle by ID
router.put(
  "/:id",
  authorizeJwt,
  verifyAccount([{ name: "vehicle", action: "update" }]),
  async (req, res) => {
    try {
      const { id } = req.params;

      // Update the vehicle by ID
      const vehicle = await Vehicle.findByIdAndUpdate(id, req.body, {
        new: true,
      });
      if (!vehicle) {
        return res
          .status(404)
          .json({ message: `Cannot find any vehicle with ID ${id}` });
      }

      res.status(200).json(vehicle);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: error.message });
    }
  },
);
// DELETE /vehicle/:id - Delete a vehicle by ID
router.delete(
  "/:id",
  authorizeJwt,
  verifyAccount([{ name: "vehicle", action: "delete" }]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const vehicle = await Vehicle.findByIdAndDelete(id);

      if (!vehicle) {
        return res
          .status(404)
          .json({ message: `Cannot find any vehicle with ID ${id}` });
      }

      res.status(200).json(vehicle);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: error.message });
    }
  },
);

module.exports = router;
