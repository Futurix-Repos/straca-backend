const express = require("express");
const router = express.Router();
const ProductType = require("../models/productTypeModel");

const mongoose = require("mongoose");
const { authorizeJwt, verifyAccount } = require("../helpers/verifyAccount");

// GET /productType - Get all package types
router.get(
  "/",
  authorizeJwt,
  verifyAccount([{ name: "productType", action: "read" }]),
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
      const productType = await ProductType.find(filter);
      res.status(200).json(productType);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: error.message });
    }
  },
);

// GET /productTypes/:id - Get a specific package type by ID
router.get(
  "/:id",
  authorizeJwt,
  verifyAccount([{ name: "productType", action: "read" }]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const productType = await ProductType.findById(id);

      if (!productType) {
        return res
          .status(404)
          .json({ message: `Product type with ID ${id} not found` });
      }

      res.status(200).json(productType);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: error.message });
    }
  },
);

// POST /productTypes - Create a new package type
router.post(
  "/",
  authorizeJwt,
  verifyAccount([{ name: "productType", action: "create" }]),
  async (req, res) => {
    try {
      // Generate a new ObjectId for the _id field
      const newId = new mongoose.Types.ObjectId();

      // Assign the generated _id to req.body
      req.body._id = newId;

      const productType = await ProductType.create(req.body);
      res.status(201).json(productType);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: error.message });
    }
  },
);

// PUT /productTypes/:id - Update a package type by ID
router.put(
  "/:id",
  authorizeJwt,
  verifyAccount([{ name: "productType", action: "update" }]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const productType = await ProductType.findByIdAndUpdate(id, req.body, {
        new: true,
      });

      if (!productType) {
        return res
          .status(404)
          .json({ message: `Cannot find any product type with ID ${id}` });
      }

      res.status(200).json(productType);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: error.message });
    }
  },
);

// DELETE /productTypes/:id - Delete a package type by ID
router.delete(
  "/:id",
  authorizeJwt,
  verifyAccount([{ name: "productType", action: "delete" }]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const productType = await ProductType.findByIdAndDelete(id);

      if (!productType) {
        return res
          .status(404)
          .json({ message: `Cannot find any product type with ID ${id}` });
      }

      res.status(200).json(productType);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: error.message });
    }
  },
);

module.exports = router;
