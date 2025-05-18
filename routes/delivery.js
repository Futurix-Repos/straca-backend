const express = require("express");
const router = express.Router();
const Delivery = require("../models/deliveryModel");
const Order = require("../models/orderModel");

const { sendMsg } = require("../helpers/fasterMessageHelper");
const { authorizeJwt, verifyAccount } = require("../helpers/verifyAccount");
const mongoose = require("mongoose");
const ProductMeasureUnit = require("../models/productMeasureUnitModel");
const Transaction = require("../models/transactionModel");
const qosService = require("../helpers/qosHelper");
const cron = require("node-cron");
const { generateReference, ORDER_STATUS } = require("../helpers/constants");
const uuid = require("uuid");
const {
  spaceImageDeleteHelper,
  spaceImageUploadHelper,
} = require("../helpers/spaceImageUploadHelper");
const multer = require("multer");
const { exportDeliveryToPdf } = require("../services/delivery");
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
    select: "name registrationNumber",
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
    path: "departureAddress",
    select: "label description",
  },
  {
    path: "order",
    select: "reference status description",
  },
  {
    path: "destination",
    select: "name location",
  },
  {
    path: "replacementDriver",
    select: "firstName lastName email telephone",
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
        departureAddress,
        destination,
        vehicle,
        order,
        productMeasureUnit,
        quantity,
        note,
        replacementDriver,
      } = req.body;

      console.log(req.body);

      // Check for any deliveries where either sender and receiver hasn't validated
      const pendingDelivery = await Delivery.findOne({
        vehicle: vehicle,
        "sender.validate": false,
        "receiver.validate": false,
      }).populate([
        {
          path: "sender.user",
          select: "firstName lastName",
        },
        {
          path: "receiver.user",
          select: "firstName lastName",
        },
        {
          path: "order",
          select: "reference",
        },
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

      // Create delivery with sender information
      const delivery = new Delivery({
        _id: newId,
        reference,
        departureAddress,
        destination,
        vehicle,
        order,
        productMeasureUnit,
        ...(replacementDriver && { replacementDriver }),
        sender: {
          user: req.user._id, // Current authenticated user
          quantity,
          note,
          validate: false,
          validateBy: null,
        },
        status: "IN_PROGRESS",
      });

      await delivery.validate();
      const savedDelivery = await delivery.save();

      await Order.findByIdAndUpdate(order, {
        status: ORDER_STATUS.IN_PROGRESS,
      });

      const populatedDelivery = await Delivery.findById(
        savedDelivery._id,
      ).populate(populateArray);

      res.status(201).json({
        success: true,
        data: populatedDelivery,
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

      res.status(200).json({
        message: "Delivery canceled successfully",
        data: delivery,
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
  upload.single("proof"), // Expect a file named "proof"
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

      let proofUrl = delivery.receiver?.proof || null;
      if (req.file) {
        // Delete existing proof file if it exists
        if (proofUrl) {
          await spaceImageDeleteHelper(proofUrl);
        }
        // Upload new proof file to 'proofs' folder
        proofUrl = await spaceImageUploadHelper(
          req.file,
          `deliveries/${deliveryId}/proofs/`,
        );
      }

      // Update the delivery with receiver information
      delivery.receiver = {
        user: req.user._id,
        proof: proofUrl,
        quantity,
        note,
        validate: false,
        validateBy: null,
      };
      delivery.status = "PENDING";

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
      const { departureAddress, destination, replacementDriver } = req.body;

      // Find the delivery and verify it exists
      const delivery = await Delivery.findById(deliveryId);
      if (!delivery) {
        return res.status(404).json({
          success: false,
          message: "Delivery not found",
        });
      }

      const orderDoc = await Order.findById(order);
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

      if (departureAddress) delivery.departureAddress = departureAddress;
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
      if (delivery.sender.validate || delivery.receiver.validate) {
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

module.exports = router;
