const express = require("express");
const router = express.Router();

const mongoose = require("mongoose");
const { authorizeJwt, verifyAccount } = require("../helpers/verifyAccount");
const ContractType = require("../models/contractTypeModel");

// GET /contractTypeLists - Get all contractTypesLists
router.get(
  "/",
  authorizeJwt,
  verifyAccount([{ name: "ContractType", action: "read" }]),
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
      const contractType = await ContractType.find(filter);
      res.status(200).json(contractType);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: error.message });
    }
  }
);

// GET /contractTypeLists/:id - Get a specific contractTypeList by ID
router.get(
  "/:id",
  authorizeJwt,
  verifyAccount([{ name: "ContractType", action: "read" }]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const contractType = await ContractType.findById(id);

      if (!contractType) {
        return res
          .status(404)
          .json({ message: `ContractType with ID ${id} not found` });
      }

      res.status(200).json(contractType);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: error.message });
    }
  }
);

// POST /contractTypeList - Create a new contractTypeList
router.post(
  "/",
  authorizeJwt,
  verifyAccount([{ name: "ContractType", action: "create" }]),
  async (req, res) => {
    try {
      // Generate a new ObjectId for the _id field
      const newId = new mongoose.Types.ObjectId();

      // Assign the generated _id to req.body
      req.body._id = newId;

      const contractType = await ContractType.create(req.body);
      res.status(201).json(contractType);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: error.message });
    }
  }
);

// PUT /contractTypeList/:id - Update a contractTypeList by ID
router.put(
  "/:id",
  authorizeJwt,
  verifyAccount([{ name: "ContractType", action: "update" }]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const contractType = await ContractType.findByIdAndUpdate(id, req.body, {
        new: true,
      });

      if (!contractType) {
        return res
          .status(404)
          .json({ message: `Cannot find any contractTypeList with ID ${id}` });
      }

      res.status(200).json(contractType);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: error.message });
    }
  }
);

// DELETE /contractTypeList/:id - Delete a ContractType by ID
router.delete(
  "/:id",
  authorizeJwt,
  verifyAccount([{ name: "ContractType", action: "delete" }]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const contractType = await ContractType.findByIdAndDelete(id);

      if (!contractType) {
        return res
          .status(404)
          .json({ message: `Cannot find any ContractType with ID ${id}` });
      }

      res.status(200).json(contractType);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: error.message });
    }
  }
);

module.exports = router;
