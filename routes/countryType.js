const express = require("express");
const router = express.Router();

const mongoose = require("mongoose");
const { authorizeJwt, verifyAccount } = require("../helpers/verifyAccount");
const CountryType = require("../models/countryTypeModel");

// GET /countryLists - Get all countryLists
router.get(
  "/",
  authorizeJwt,
  verifyAccount([{ name: "CountryType", action: "read" }]),
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
      const country = await CountryType.find(filter);
      res.status(200).json(country);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: error.message });
    }
  }
);

// GET /countryLists/:id - Get a specific countryList by ID
router.get(
  "/:id",
  authorizeJwt,
  verifyAccount([{ name: "CountryType", action: "read" }]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const country = await CountryType.findById(id);

      if (!country) {
        return res
          .status(404)
          .json({ message: `CountryType with ID ${id} not found` });
      }

      res.status(200).json(country);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: error.message });
    }
  }
);

// POST /countryList - Create a new countryList
router.post(
  "/",
  authorizeJwt,
  verifyAccount([{ name: "CountryType", action: "create" }]),
  async (req, res) => {
    try {
      // Generate a new ObjectId for the _id field
      const newId = new mongoose.Types.ObjectId();

      // Assign the generated _id to req.body
      req.body._id = newId;

      const country = await CountryType.create(req.body);
      res.status(201).json(country);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: error.message });
    }
  }
);

// PUT /countryList/:id - Update a countryList by ID
router.put(
  "/:id",
  authorizeJwt,
  verifyAccount([{ name: "CountryType", action: "update" }]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const country = await CountryType.findByIdAndUpdate(id, req.body, {
        new: true,
      });

      if (!country) {
        return res
          .status(404)
          .json({ message: `Cannot find any countryList with ID ${id}` });
      }

      res.status(200).json(country);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: error.message });
    }
  }
);

// DELETE /countryList/:id - Delete a countryType by ID
router.delete(
  "/:id",
  authorizeJwt,
  verifyAccount([{ name: "CountryType", action: "delete" }]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const country = await CountryType.findByIdAndDelete(id);

      if (!country) {
        return res
          .status(404)
          .json({ message: `Cannot find any countryType with ID ${id}` });
      }

      res.status(200).json(country);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: error.message });
    }
  }
);

module.exports = router;
