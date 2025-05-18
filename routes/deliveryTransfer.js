const express = require("express");
const router = express.Router();
const DeliveryTransfer = require("../models/deliveryTransferModel");
const Delivery = require("../models/deliveryModel");

const { authorizeJwt, verifyAccount } = require("../helpers/verifyAccount");

router.get(
  "/",
  authorizeJwt,
  verifyAccount([{ name: "delivery", action: "read" }]),
  async (req, res) => {
    try {
      const transfers = await DeliveryTransfer.find()
        .populate("delivery", "reference status")
        .populate("fromVehicle", "registrationNumber")
        .populate("toVehicle", "registrationNumber")
        .populate("transferredBy", "firstName lastName email");

      res.status(200).json(transfers);
    } catch (error) {
      console.error("List transfers error:", error);
      res.status(500).json({ message: "Failed to list delivery transfers" });
    }
  },
);

router.get(
  "/:id",
  authorizeJwt,
  verifyAccount([{ name: "delivery", action: "read" }]),
  async (req, res) => {
    try {
      const transfer = await DeliveryTransfer.findById(req.params.id)
        .populate("delivery", "reference status")
        .populate("fromVehicle", "registrationNumber")
        .populate("toVehicle", "registrationNumber")
        .populate("transferredBy", "firstName lastName email");

      if (!transfer) {
        return res.status(404).json({ message: "Transfer not found" });
      }

      res.status(200).json(transfer);
    } catch (error) {
      console.error("Get transfer error:", error);
      res.status(500).json({ message: "Failed to get delivery transfer" });
    }
  },
);

router.post(
  "/",
  authorizeJwt,
  verifyAccount([{ name: "delivery", action: "update" }]),
  async (req, res) => {
    try {
      const { deliveryId, toVehicleId } = req.body;

      if (!deliveryId || !toVehicleId) {
        return res.status(400).json({
          message: "Le champ 'deliveryId' ou 'toVehicleId' sont requis.",
        });
      }

      const delivery = await Delivery.findById(deliveryId);
      if (!delivery) {
        return res.status(404).json({ message: "Delivery not found" });
      }

      if (delivery.status === "CANCELED" || delivery.status === "DELIVERED") {
        return res
          .status(400)
          .json({ message: "Cannot transfer a canceled delivery" });
      }

      const fromVehicle = delivery.vehicle;

      if (delivery.vehicle.toString() === toVehicleId.toString()) {
        return res.status(400).json({
          message:
            "Le véhicule de destination ne peut pas être identique au véhicule actuel.",
        });
      }

      const ongoingDelivery = await Delivery.findOne({
        vehicle: toVehicleId,
        status: "IN_PROGRESS",
      });

      if (ongoingDelivery) {
        return res.status(400).json({
          message: `Le véhicule sélectionné (${toVehicleId}) a déjà une livraison en cours.`,
        });
      }

      const transfer = new DeliveryTransfer({
        delivery: deliveryId,
        fromVehicle,
        toVehicle: toVehicleId,
        transferredBy: req.user._id,
      });

      await transfer.validate(); // pour déclencher la validation de limite
      await transfer.save();

      // Mise à jour du véhicule principal dans Delivery
      delivery.vehicle = toVehicleId;
      await delivery.save();

      res.status(201).json({
        message: "Delivery transfer created successfully",
        data: transfer,
      });
    } catch (error) {
      console.error("Create transfer error:", error);
      res.status(500).json({
        message: "Failed to create delivery transfer",
        error: error.message,
      });
    }
  },
);

module.exports = router;
