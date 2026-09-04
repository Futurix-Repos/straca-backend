const express = require("express");
const router = express.Router();
const Delivery = require("../models/deliveryModel");
const Order = require("../models/orderModel");
const Section = require("../models/sectionModel");

const { authorizeJwt, verifyAccount } = require("../helpers/verifyAccount");
const mongoose = require("mongoose");
const { generateReference, ORDER_STATUS } = require("../helpers/constants");
const multer = require("multer");
const { exportDeliveryToPdf } = require("../services/delivery");
const vehicleTrackingService = require("../services/vehicleTracking");
const { skippedReceiverEvidence } = require("../services/deliveryEvidence");
const upload = multer({ storage: multer.memoryStorage() });

const populateArray = [
  {
    path: "sender.user",
    select: "firstName lastName email telephone",
  },
  {
    path: "receiver.user",
    select: "firstName lastName email telephone",
  },
  {
    path: "sender.validateBy",
    select: "firstName lastName email telephone",
  },
  {
    path: "receiver.validateBy",
    select: "firstName lastName email telephone",
  },
  {
    path: "productMeasureUnit",
    populate: {
      path: "product",
      select: "name description",
    },
  },
  {
    path: "productMeasureUnit",
    populate: {
      path: "measureUnit",
      select: "label description",
    },
  },
  {
    path: "vehicle",
    select: "name registrationNumber tracking",
    populate: [
      {
        path: "driver",
        select: "firstName lastName phone",
      },
      {
        path: "model",
        select: "label",
        populate: {
          path: "brand",
          select: "label",
        },
      },
      {
        path: "source",
        select: "label isExternal",
      },
    ],
  },
  {
    path: "departureChantier",
    select: "label description",
  },
  {
    path: "departureSection",
    select: "label description chantier",
    populate: {
      path: "chantier",
      select: "label description",
    },
  },
  {
    path: "order",
    select: "reference status description",
  },
  {
    path: "destinationCarriere",
    select: "label description",
  },
  {
    path: "destination",
    select: "name location",
  },
  {
    path: "replacementDriver",
    select: "firstName lastName email telephone",
  },
  {
    path: "prestataire",
    select: "name type zone phone",
  },
];

router.get(
  "/",
  authorizeJwt,
  verifyAccount([{ name: "delivery", action: "read" }]),
  async (req, res) => {
    const filter = {};
    const search = req.query.search;
    const status = req.query.status;
    const vehicleId = req.query.vehicleId;

    // Add status filter if provided
    if (status) {
      if (Array.isArray(status)) {
        filter.status = { $in: status.map((s) => s.toUpperCase()) };
      } else if (typeof status === "string") {
        filter.status = status.toUpperCase();
      }
    }

    if (vehicleId) {
      filter.vehicle = vehicleId;
    }

    const { chantierId, sectionId } = req.query;
    if (sectionId) {
      filter.departureSection = sectionId;
    } else if (chantierId) {
      const sections = await Section.find({ chantier: chantierId }).select("_id");
      filter.departureSection = { $in: sections.map((s) => s._id) };
    }

    // Add search filter if provided
    if (search) {
      filter.$or = [
        { reference: { $regex: search, $options: "i" } },
        { "sender.note": { $regex: search, $options: "i" } },
        { "receiver.note": { $regex: search, $options: "i" } },
        { status: { $regex: search, $options: "i" } },
      ];
    }

    try {
      let populate = populateArray;

      const deliveries = await Delivery.find(filter)
        .populate(populate)
        .sort({ createdAt: -1 });

      res.status(200).json(deliveries);
    } catch (error) {
      console.log(error.message);
      res.status(500).json({ message: error.message });
    }
  },
);

router.get(
  "/:id",
  authorizeJwt,
  verifyAccount([{ name: "delivery", action: "read" }]),
  async (req, res) => {
    try {
      const { id } = req.params;
      let filter = { _id: id };

      // For clients, use populate with match to only include orders they own
      const populateOptions =
        req.user.type === "client"
          ? [
              {
                path: "order",
                match: { client: req.user._id }, // This will return null if order doesn't belong to client
              },
              ...populateArray.filter((p) => p.path !== "order"),
            ] // Include other standard populates
          : populateArray; // For admin/employee, use standard populates

      const delivery = await Delivery.findOne(filter).populate(populateOptions);

      // For clients, if no matching order was found (populated as null), return 404
      if (!delivery || (req.user.type === "client" && !delivery.order)) {
        return res.status(404).json({
          message: `Cannot find any Delivery with ID ${id}`,
        });
      }

      res.status(200).json(delivery);
    } catch (error) {
      console.log(error.message);
      res.status(500).json({ message: error.message });
    }
  },
);

router.post(
  "/sender",
  authorizeJwt,
  verifyAccount([{ name: "delivery", action: "create" }]),
  async (req, res) => {
    try {
      const {
        departureChantier,
        departureSection,
        destination,
        destinationCarriere,
        vehicle,
        order,
        productMeasureUnit,
        quantity,
        note,
        replacementDriver,
        prestataire,
        autoStartTracking = true,
      } = req.body;

      if (!departureChantier) {
        return res.status(400).json({
          success: false,
          message: "Le chantier de départ est requis.",
        });
      }

      // Validation : soit (order + destination) soit destinationCarriere
      if (destinationCarriere && destination) {
        return res.status(400).json({
          success: false,
          message: "Fournissez soit une adresse de destination soit une carrière, pas les deux.",
        });
      }
      if (!destinationCarriere && !destination) {
        return res.status(400).json({
          success: false,
          message: "Une destination est requise (adresse ou carrière).",
        });
      }
      if (order && !destination) {
        return res.status(400).json({
          success: false,
          message: "Une adresse de destination est requise pour une livraison avec commande.",
        });
      }

      // Check for any deliveries where either sender and receiver hasn't validated
      const pendingDelivery = await Delivery.findOne({
        vehicle: vehicle,
        "sender.validate": false,
        "receiver.validate": false,
      }).populate([
        { path: "sender.user", select: "firstName lastName" },
        { path: "receiver.user", select: "firstName lastName" },
        { path: "order", select: "reference" },
      ]);

      if (pendingDelivery) {
        return res.status(400).json({
          success: false,
          message: "Vehicle has pending delivery validation",
          delivery: {
            reference: pendingDelivery.reference,
            order: pendingDelivery.order?.reference,
            sender: {
              name: `${pendingDelivery?.sender?.user?.firstName ?? "-"} ${pendingDelivery?.sender?.user?.lastName ?? "-"}`,
              validated: pendingDelivery.sender.validate,
            },
            receiver: {
              name: `${pendingDelivery?.receiver?.user?.firstName ?? "-"} ${pendingDelivery?.receiver?.user?.lastName ?? "-"}`,
              validated: pendingDelivery.receiver.validate,
            },
          },
        });
      }

      const newId = new mongoose.Types.ObjectId();
      const reference = generateReference({
        data: newId.toString(),
        prefix: "VOY",
        length: 7,
      });

      const delivery = new Delivery({
        _id: newId,
        reference,
        startedAt: new Date(),
        departureChantier,
        ...(departureSection && { departureSection }),
        ...(destination && { destination }),
        ...(destinationCarriere && { destinationCarriere }),
        vehicle,
        ...(order && { order }),
        productMeasureUnit,
        ...(replacementDriver && { replacementDriver }),
        ...(prestataire && { prestataire }),
        sender: {
          user: req.user._id,
          quantity,
          note,
          validate: false,
          validateBy: null,
        },
        status: "IN_PROGRESS",
      });

      await delivery.validate();
      const savedDelivery = await delivery.save();

      if (order) {
        await Order.findByIdAndUpdate(order, {
          status: ORDER_STATUS.IN_PROGRESS,
        });
      }

      const populatedDelivery = await Delivery.findById(
        savedDelivery._id,
      ).populate(populateArray);

      let trackingResult = null;
      if (autoStartTracking) {
        try {
          trackingResult = await vehicleTrackingService.startDeliveryTracking(
            savedDelivery._id.toString(),
            vehicle,
            300, //5min
          );
          console.log(
            `✅ Tracking started for delivery ${savedDelivery.reference}`,
          );
        } catch (trackingError) {
          console.error(
            "⚠️  Warning: Could not start tracking:",
            trackingError.message,
          );
        }
      }

      res.status(201).json({
        success: true,
        data: populatedDelivery,
        tracking: trackingResult,
      });
    } catch (error) {
      console.error("Error in createDeliveryBySender:", error);

      if (error.name === "ValidationError") {
        return res.status(400).json({
          success: false,
          message: "Validation Error",
          errors: Object.values(error.errors).map((err) => err.message),
        });
      }

      res.status(500).json({
        success: false,
        message: "Error creating delivery",
        error: error.message,
      });
    }
  },
);

router.put(
  "/cancel/:id",
  authorizeJwt,
  verifyAccount([{ name: "delivery", action: "update" }]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const delivery = await Delivery.findById(id);
      if (!delivery) {
        return res.status(404).json({ message: "Delivery not found" });
      }

      if (delivery?.canceled?.isCanceled) {
        return res.status(400).json({ message: "Delivery already canceled" });
      }

      delivery.status = "CANCELED";

      delivery.canceled = {
        isCanceled: true,
        reason,
        canceledAt: new Date(),
        canceledBy: req.user._id,
      };

      await delivery.save();

      let trackingResult = null;
      try {
        trackingResult = await vehicleTrackingService.stopDeliveryTracking(id);
        console.log(
          `🛑 Tracking stopped for canceled delivery ${delivery.reference}`,
        );
      } catch (trackingError) {
        console.error(
          "⚠️  Warning: Could not stop tracking:",
          trackingError.message,
        );
      }

      res.status(200).json({
        message: "Delivery canceled successfully",
        data: delivery,
        tracking: trackingResult,
      });
    } catch (error) {
      console.error("Cancel delivery error:", error);
      res
        .status(500)
        .json({ message: "Error canceling delivery", error: error.message });
    }
  },
);

router.put(
  "/receiver/:deliveryId",
  authorizeJwt,
  verifyAccount([{ name: "delivery", action: "update" }]),
  upload.fields([
    { name: "proofs", maxCount: 5 },
    { name: "receiverSignature", maxCount: 1 },
    { name: "clientRepresentativeSignature", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const { deliveryId } = req.params;
      const { quantity, note } = req.body;

      // Find the delivery and verify it exists
      const delivery = await Delivery.findById(deliveryId);
      if (!delivery) {
        return res.status(404).json({
          success: false,
          message: "Delivery not found",
        });
      }

      if (delivery?.canceled?.isCanceled) {
        return res.status(400).json({
          success: false,
          message:
            "Cette livraison a été annulée. Elle ne peut pas être modifiée.",
        });
      }

      // Verify delivery status is PENDING
      if (delivery.status !== "IN_PROGRESS") {
        return res.status(400).json({
          success: false,
          message: "Delivery cannot be modified in its current status",
        });
      }

      if (delivery.sender.user.toString() === req.user._id.toString()) {
        return res.status(400).json({
          success: false,
          message: "Sender and Receiver can be the same",
        });
      }

      // Les fichiers multipart restent acceptés pour préserver le client, mais ne sont plus stockés.
      const evidence = await skippedReceiverEvidence();

      const hasQuantityDifference = Number(delivery.sender.quantity) !== Number(quantity);

      // En cas d'écart, la réception est enregistrée mais reste non validée.
      delivery.receiver = {
        user: req.user._id,
        ...evidence,
        quantity,
        note,
        receivedAt: new Date(),
        validate: !hasQuantityDifference,
        validateBy: hasQuantityDifference ? null : req.user._id,
      };
      delivery.status = hasQuantityDifference ? "PENDING" : "DELIVERED";
      delivery.adminValidation = {
        status: hasQuantityDifference ? "PENDING" : "NOT_REQUIRED",
        validatedBy: null,
        validatedAt: null,
        note: null,
      };

      await delivery.validate();
      const updatedDelivery = await delivery.save();

      let trackingResult = null;
      try {
        trackingResult =
          await vehicleTrackingService.stopDeliveryTracking(deliveryId);
        console.log(
          `🏁 Tracking stopped for completed delivery ${delivery.reference}`,
        );
      } catch (trackingError) {
        console.error(
          "⚠️  Warning: Could not stop tracking:",
          trackingError.message,
        );
      }

      const populatedDelivery = await Delivery.findById(
        updatedDelivery._id,
      ).populate(populateArray);

      res.status(200).json({
        success: true,
        data: populatedDelivery,
        tracking: trackingResult,
      });
    } catch (error) {
      console.error("Error in updateDeliveryByReceiver:", error);

      if (error.name === "ValidationError") {
        return res.status(400).json({
          success: false,
          message: "Validation Error",
          errors: Object.values(error.errors).map((err) => err.message),
        });
      }

      res.status(500).json({
        success: false,
        message: "Error updating delivery",
        error: error.message,
      });
    }
  },
);

router.put(
  "/sender/:deliveryId",
  authorizeJwt,
  verifyAccount([{ name: "delivery", action: "update" }]),
  async (req, res) => {
    try {
      const { deliveryId } = req.params;
      const { departureChantier, departureSection, destination, replacementDriver } = req.body;

      // Find the delivery and verify it exists
      const delivery = await Delivery.findById(deliveryId);
      if (!delivery) {
        return res.status(404).json({
          success: false,
          message: "Delivery not found",
        });
      }

      const orderDoc = await Order.findById(delivery.order);
      if (!orderDoc) {
        return res.status(404).json({
          success: false,
          message: "Commande associée introuvable.",
        });
      }

      if (
        orderDoc?.canceled?.isCanceled ||
        orderDoc?.status === ORDER_STATUS.CANCELED
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Impossible de créer une livraison pour une commande annulée.",
        });
      }

      if (delivery?.canceled?.isCanceled) {
        return res.status(400).json({
          success: false,
          message:
            "Cette livraison a été annulée. Elle ne peut pas être modifiée.",
        });
      }

      // Verify delivery status is PENDING
      if (delivery.status !== "IN_PROGRESS") {
        return res.status(400).json({
          success: false,
          message: "Delivery cannot be modified in its current status",
        });
      }

      if (delivery.sender.user.toString() !== req.user._id.toString()) {
        return res.status(400).json({
          success: false,
          message: "Only the sender can update this delivery",
        });
      }

      if (departureChantier) delivery.departureChantier = departureChantier;
      if (departureSection !== undefined) delivery.departureSection = departureSection || null;
      if (destination) delivery.destination = destination;
      if (replacementDriver) delivery.replacementDriver = replacementDriver;

      await delivery.validate();
      const updatedDelivery = await delivery.save();

      const populatedDelivery = await Delivery.findById(
        updatedDelivery._id,
      ).populate(populateArray);

      res.status(200).json({
        success: true,
        data: populatedDelivery,
      });
    } catch (error) {
      console.error("Error in updateDeliveryBySender:", error);

      if (error.name === "ValidationError") {
        return res.status(400).json({
          success: false,
          message: "Validation Error",
          errors: Object.values(error.errors).map((err) => err.message),
        });
      }

      res.status(500).json({
        success: false,
        message: "Error updating delivery",
        error: error.message,
      });
    }
  },
);

router.put(
  "/admin-validate/:deliveryId",
  authorizeJwt,
  verifyAccount([{ name: "delivery", action: "update" }]),
  async (req, res) => {
    try {
      const { decision, note } = req.body;
      if (!["APPROVED", "DISPUTED"].includes(decision)) {
        return res.status(400).json({ message: "Décision de validation invalide." });
      }
      if (decision === "DISPUTED" && !note?.trim()) {
        return res.status(400).json({ message: "Un motif est requis pour signaler un écart." });
      }

      const delivery = await Delivery.findById(req.params.deliveryId);
      if (!delivery || !delivery.receiver?.user) {
        return res.status(404).json({ message: "Réception introuvable." });
      }

      delivery.adminValidation = {
        status: decision,
        validatedBy: req.user._id,
        validatedAt: new Date(),
        note: note?.trim() || null,
      };
      delivery.status = decision === "APPROVED" ? "DELIVERED" : "PENDING";
      await delivery.save();

      const populatedDelivery = await Delivery.findById(delivery._id).populate(populateArray);
      res.status(200).json({ success: true, data: populatedDelivery });
    } catch (error) {
      res.status(500).json({ message: "Erreur de validation administrative", error: error.message });
    }
  },
);

router.put(
  "/confirm/:deliveryId",
  authorizeJwt,
  verifyAccount([{ name: "delivery", action: "update" }]),
  async (req, res) => {
    try {
      const { deliveryId } = req.params;
      const { role } = req.body; // 'sender' or 'receiver'
      const userId = req.user._id; // Current authenticated user

      // Validate role parameter
      if (!["sender", "receiver"].includes(role)) {
        return res.status(400).json({
          success: false,
          message: "Role must be either 'sender' or 'receiver'",
        });
      }

      // Find the delivery
      const delivery = await Delivery.findById(deliveryId);
      if (!delivery) {
        return res.status(404).json({
          success: false,
          message: "Delivery not found",
        });
      }

      if (delivery?.canceled?.isCanceled) {
        return res.status(400).json({
          success: false,
          message:
            "Cette livraison a été annulée. Elle ne peut pas être modifiée.",
        });
      }

      // Update the validation
      if (role === "sender") {
        delivery.sender.validate = true;
        delivery.sender.validateBy = userId;
      } else {
        delivery.receiver.validate = true;
        delivery.receiver.validateBy = userId;
      }

      // Check if both sender and receiver have validated
      const isDeliveryComplete =
        delivery.sender.validate || delivery.receiver.validate;
      if (isDeliveryComplete) {
        delivery.status = "DELIVERED";
      }

      // Save the changes
      await delivery.save();

      // Return populated delivery
      const populatedDelivery =
        await Delivery.findById(deliveryId).populate(populateArray);

      res.status(200).json({
        success: true,
        message: `Delivery ${role} confirmation successful`,
        data: populatedDelivery,
      });
    } catch (error) {
      console.error("Error in confirmDeliveryParticipant:", error);
      res.status(500).json({
        success: false,
        message: "Error confirming delivery participant",
        error: error.message,
      });
    }
  },
);

router.delete(
  "/:id",
  authorizeJwt,
  verifyAccount([{ name: "delivery", action: "delete" }]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const deletedOrder = await Order.findByIdAndDelete(id);
      if (!deletedOrder) {
        return res
          .status(404)
          .json({ message: `Cannot find any Commande with ID ${id}` });
      }
      res.status(200).json(deletedOrder);
    } catch (error) {
      console.log(error.message);
      res.status(500).json({ message: error.message });
    }
  },
);

router.get(
  "/export-to-pdf/:deliveryId",
  authorizeJwt,
  verifyAccount([{ name: "delivery", action: "read" }]),
  async (req, res, next) => {
    const { deliveryId } = req.params;
    try {
      const blob = await exportDeliveryToPdf({
        deliveryId,
      });

      const buffer = Buffer.from(await blob.arrayBuffer());

      // Send the Blob as the response
      res.send(buffer);
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  "/tracking/start/:deliveryId",
  authorizeJwt,
  verifyAccount([{ name: "delivery", action: "update" }]),
  async (req, res) => {
    try {
      const { deliveryId } = req.params;
      const { intervalSeconds = 300 } = req.body;

      const delivery = await Delivery.findById(deliveryId).populate("vehicle");
      if (!delivery) {
        return res.status(404).json({
          success: false,
          message: "Delivery not found",
        });
      }

      if (delivery.status !== "IN_PROGRESS") {
        return res.status(400).json({
          success: false,
          message: "Tracking can only be started for deliveries in progress",
        });
      }

      const result = await vehicleTrackingService.startDeliveryTracking(
        deliveryId,
        delivery.vehicle._id.toString(),
        intervalSeconds,
      );

      res.status(200).json(result);
    } catch (error) {
      console.error("Error starting tracking:", error);
      res.status(500).json({
        success: false,
        message: "Error starting tracking",
        error: error.message,
      });
    }
  },
);

router.post(
  "/tracking/stop/:deliveryId",
  authorizeJwt,
  verifyAccount([{ name: "delivery", action: "update" }]),
  async (req, res) => {
    try {
      const { deliveryId } = req.params;

      const result =
        await vehicleTrackingService.stopDeliveryTracking(deliveryId);

      res.status(200).json(result);
    } catch (error) {
      console.error("Error stopping tracking:", error);
      res.status(500).json({
        success: false,
        message: "Error stopping tracking",
        error: error.message,
      });
    }
  },
);

router.get(
  "/tracking/history/:deliveryId",
  authorizeJwt,
  verifyAccount([{ name: "delivery", action: "read" }]),
  async (req, res) => {
    try {
      const { deliveryId } = req.params;
      const { format = "json" } = req.query;

      const result = await vehicleTrackingService.getDeliveryHistory(
        deliveryId,
        format,
      );

      res.status(200).json(result);
    } catch (error) {
      console.error("Error getting delivery history:", error);
      res.status(500).json({
        success: false,
        message: "Error getting delivery history",
        error: error.message,
      });
    }
  },
);

router.get(
  "/tracking/current/:vehicleId",
  authorizeJwt,
  verifyAccount([{ name: "vehicle", action: "read" }]),
  async (req, res) => {
    try {
      const { vehicleId } = req.params;

      const result = await vehicleTrackingService.getCurrentPosition(vehicleId);

      res.status(200).json(result);
    } catch (error) {
      console.error("Error getting current position:", error);
      res.status(500).json({
        success: false,
        message: "Error getting current position",
        error: error.message,
      });
    }
  },
);

router.get(
  "/tracking/stats",
  authorizeJwt,
  verifyAccount([{ name: "delivery", action: "read" }]),
  async (req, res) => {
    try {
      const stats = vehicleTrackingService.getTrackingStats();
      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error("Error getting tracking stats:", error);
      res.status(500).json({
        success: false,
        message: "Error getting tracking stats",
        error: error.message,
      });
    }
  },
);

module.exports = router;
