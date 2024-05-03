const express = require("express");
const router = express.Router();
const Tracking = require("../models/trackingModel");

const mongoose = require("mongoose");
const { authorizeJwt, verifyAccount } = require("../helpers/verifyAccount"); 
const Commande = require("../models/commandeModel");
// GET /tracking - Get all trackings
router.get(
  "/",
  authorizeJwt,
  verifyAccount([{ name: "tracking", action: "read" }]),
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
      const tracking = await Tracking.find(filter).populate("createdBy");
      res.status(200).json(tracking);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: error.message });
    }
  }
);

// GET /tracking/:id - Get a specific tracking by ID
router.get(
  "/:id",
  authorizeJwt,
  verifyAccount([{ name: "tracking", action: "read" }]),
  
  async (req, res) => {
    try {
      const { id } = req.params;
      const tracking = await Tracking.findById(id);

      if (!tracking) {
        return res
          .status(404)
          .json({ message: `Tracking with ID ${id} not found` });
      }

      res.status(200).json(tracking);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: error.message });
    }
  }
);

// POST /tracking - Create a new tracking
router.post(
  "/",
  authorizeJwt,
  verifyAccount([{ name: "tracking", action: "create" }]),
  async (req, res) => {
    try {
        const {orderId} = req.body;
        if(!mongoose.Types.ObjectId.isValid(orderId)){
            return res.status(404).json({message: `Le OrderId n'est pas un ID d'objet valide`})
        }
        //check if the orderId exists in the DB
        const existingOrder = await Commande.findById(orderId);
        if(!existingOrder) {
            return res.status(404).json({message: `Commande Id avec Id ${orderId} ni trouvé`})
        }
      // Generate a new ObjectId for the _id field
      const newId = new mongoose.Types.ObjectId();

      // Assign the generated _id and imageUrl to req.body
      req.body._id = newId;
      

      // Create the tracking with the provided data
      const tracking = await Tracking.create(req.body);
      res.status(201).json(tracking);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: error.message });
    }
  }
);

// PUT /tracking/:id - Update a tracking by ID
router.put(
    "/:id",
    authorizeJwt,
    verifyAccount([{ name: "tracking", action: "update" }]),
    async (req, res) => {
      try {
        const { id } = req.params;
        const { orderId } = req.body;
        
        // Check if the orderId exists in the database
        const existingOrder = await Commande.findById(orderId);
        if (!existingOrder) {
          return res.status(404).json({ message: `Order with ID ${orderId} not found` });
        }
        
        
        // Update the tracking by ID
        const tracking = await Tracking.findByIdAndUpdate(id, req.body, { new: true });
        if (!tracking) {
          return res
            .status(404)
            .json({ message: `Cannot find any tracking with ID ${id}` });
        }
        
        res.status(200).json(tracking);
      } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: error.message });
      }
    }
  );
// DELETE /tracking/:id - Delete a tracking by ID
router.delete(
  "/:id",
  authorizeJwt,
  verifyAccount([{ name: "tracking", action: "delete" }]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const tracking = await Tracking.findByIdAndDelete(id);

      if (!tracking) {
        return res
          .status(404)
          .json({ message: `Cannot find any tracking with ID ${id}` });
      }

      res.status(200).json(tracking);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: error.message });
    }
  }
);

module.exports = router;
