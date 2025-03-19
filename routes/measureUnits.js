const express = require("express");
const router = express.Router();
const MeasureUnit = require("../models/measureUnitModel");
const ProductMeasureUnit = require("../models/productMeasureUnitModel");

const mongoose = require("mongoose");
const { authorizeJwt, verifyAccount } = require("../helpers/verifyAccount");

// GET /measureUnits - Get all measure units
router.get(
  "/",
  authorizeJwt,
  verifyAccount([{ name: "measureUnit", action: "read" }]),
  async (req, res) => {
    const filter = {};
    const search = req.query.search;

    if (search) {
      filter.$or = [
        { description: { $regex: search, $options: "i" } },
        { label: { $regex: search, $options: "i" } },
      ];
    }

    try {
      const measureUnits = await MeasureUnit.find(filter).populate([
        {
          path: "products",
          populate: {
            path: "product",
          },
        },
      ]);
      res.status(200).json(measureUnits);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: error.message });
    }
  },
);

// GET /measureUnits/:id - Get a specific measure unit by ID
router.get(
  "/:id",
  authorizeJwt,
  verifyAccount([{ name: "measureUnit", action: "read" }]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const measureUnit = await MeasureUnit.findById(id).populate([
        {
          path: "products",
          populate: {
            path: "product",
          },
        },
      ]);

      if (!measureUnit) {
        return res
          .status(404)
          .json({ message: `Measure unit with ID ${id} not found` });
      }

      res.status(200).json(measureUnit);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: error.message });
    }
  },
);

// POST /measureUnits - Create a new measure unit
router.post(
  "/",
  authorizeJwt,
  verifyAccount([{ name: "measureUnit", action: "create" }]),
  async (req, res) => {
    try {
      // Generate a new ObjectId for the _id field
      const newId = new mongoose.Types.ObjectId();

      // Assign the generated _id to req.body
      req.body._id = newId;

      const measureUnit = await MeasureUnit.create(req.body);
      res.status(201).json(measureUnit);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: error.message });
    }
  },
);

// PUT /measureUnits/:id - Update a measure unit by ID
router.put(
  "/:id",
  authorizeJwt,
  verifyAccount([{ name: "measureUnit", action: "update" }]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const measureUnit = await MeasureUnit.findByIdAndUpdate(id, req.body, {
        new: true,
      });

      if (!measureUnit) {
        return res
          .status(404)
          .json({ message: `Cannot find any measure unit with ID ${id}` });
      }

      res.status(200).json(measureUnit);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: error.message });
    }
  },
);

// DELETE /measureUnits/:id - Delete a measure unit by ID
router.delete(
  "/:id",
  authorizeJwt,
  verifyAccount([{ name: "measureUnit", action: "delete" }]),
  async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { id } = req.params;

      // Check if measure unit exists
      const measureUnit = await MeasureUnit.findById(id);
      if (!measureUnit) {
        await session.abortTransaction();
        session.endSession();
        return res
          .status(404)
          .json({ message: `Cannot find any Measure Unit with ID ${id}` });
      }

      // Check if measure unit is used as default anywhere
      const defaultProducts = await ProductMeasureUnit.find({
        measureUnit: id,
        isDefault: true,
      }).populate("product");

      if (defaultProducts.length > 0) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          message:
            "Cannot delete measure unit that is set as default for the following products:",
          products: defaultProducts.map((pm) => ({
            id: pm.product._id,
            name: pm.product.name,
          })),
        });
      }

      // Delete all associated product-measure unit relationships
      await ProductMeasureUnit.deleteMany({ measureUnit: id }, { session });

      // Delete the measure unit
      await MeasureUnit.findByIdAndDelete(id, { session });

      await session.commitTransaction();
      session.endSession();

      res.status(200).json({ message: "Measure Unit deleted successfully" });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      console.error(error.message);
      res.status(500).json({ message: "Server Error" });
    }
  },
);

module.exports = router;
