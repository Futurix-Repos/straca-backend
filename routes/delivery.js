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
  },
  {
    path: "departureAddress",
    select: "label description",
  },
  {
    path: "order",
    select: "reference status description",
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

    // Add status filter if provided
    if (status) {
      filter.status = status;
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
      const deliveries = await Delivery.find(filter)
        .populate(populateArray)
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
      const delivery = await Delivery.findById(id).populate(populateArray);

      if (!delivery) {
        return res
          .status(404)
          .json({ message: `Cannot find any Delivery with ID ${id}` });
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
        vehicle,
        order,
        productMeasureUnit,
        quantity,
        note,
      } = req.body;

      // Check for any deliveries where either sender or receiver hasn't validated
      const pendingDelivery = await Delivery.findOne({
        vehicle: vehicle._id,
        $or: [{ "sender.validate": false }, { "receiver.validate": false }],
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
        vehicle,
        order,
        productMeasureUnit,
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
  "/receiver/:deliveryId",
  authorizeJwt,
  verifyAccount([{ name: "delivery", action: "update" }]),
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

      // Verify delivery status is PENDING
      if (delivery.status !== "IN_PROGRESS") {
        return res.status(400).json({
          success: false,
          message: "Delivery cannot be modified in its current status",
        });
      }

      // Update the delivery with receiver information
      delivery.receiver = {
        user: req.user._id, // Current authenticated user
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
  verifyAccount([{ name: "order", action: "delete" }]),
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

module.exports = router;
