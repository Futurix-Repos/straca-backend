const express = require("express");
const router = express.Router();
const Address = require("../models/addressModel");

const mongoose = require("mongoose");
const { authorizeJwt, verifyAccount } = require("../helpers/verifyAccount");

// GET /addresses - Get all Addresses
router.get(
  "/",
  authorizeJwt,
  verifyAccount([{ name: "address", action: "read" }]),
  async (req, res) => {
    const filter = {};
    const search = req.query.search;

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    try {
      const address = await Address.find(filter);
      res.status(200).json(address);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: error.message });
    }
  },
);

// GET /addresses - Get a specific addresses by ID
router.get(
  "/:id",
  authorizeJwt,
  verifyAccount([{ name: "address", action: "read" }]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const address = await Address.findById(id);

      if (!address) {
        return res
          .status(404)
          .json({ message: `address with ID ${id} not found` });
      }

      res.status(200).json(address);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: error.message });
    }
  },
);

// POST /address - Create a new address
router.post(
  "/",
  authorizeJwt,
  verifyAccount([{ name: "address", action: "create" }]),
  async (req, res) => {
    try {
      const newId = new mongoose.Types.ObjectId();

      req.body._id = newId;
      req.body.createdBy = req.user._id;

      const address = await Address.create(req.body);

      res.status(201).json(address);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: error.message });
    }
  },
);

// PUT /address/:id - Update a address by ID
router.put(
  "/:id",
  authorizeJwt,
  verifyAccount([{ name: "address", action: "update" }]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const address = await Address.findByIdAndUpdate(id, req.body, {
        new: true,
      });

      if (!address) {
        return res
          .status(404)
          .json({ message: `Cannot find any address with ID ${id}` });
      }

      res.status(200).json(address);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: error.message });
    }
  },
);

// DELETE /address/:id - Delete a address by ID
router.delete(
  "/:id",
  authorizeJwt,
  verifyAccount([{ name: "address", action: "delete" }]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const address = await Address.findByIdAndDelete(id);

      if (!address) {
        return res
          .status(404)
          .json({ message: `Cannot find any address with ID ${id}` });
      }

      res.status(200).json(address);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: error.message });
    }
  },
);

module.exports = router;
