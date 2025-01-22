const express = require("express");
const router = express.Router();
const Order = require("../models/orderModel");
const User = require("../models/userModel");
const Pricing = require("../models/pricingModel");

const { sendMsg } = require("../helpers/fasterMessageHelper");
const { authorizeJwt, verifyAccount } = require("../helpers/verifyAccount");
const mongoose = require("mongoose");
const ProductMeasureUnit = require("../models/productMeasureUnitModel");
const Transaction = require("../models/transactionModel");
const qosService = require("../helpers/qosHelper");
const cron = require("node-cron");
const { generateReference, ORDER_STATUS } = require("../helpers/constants");

const populateDeliveryArray = [
  {
    path: "sender.user",
    select: "firstName lastName email telephone",
  },
  {
    path: "receiver.user",
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
];

const populateArray = [
  {
    // Populate client with specific fields
    path: "client",
    select: "firstName lastName email",
  },
  {
    // Populate createdBy with specific fields
    path: "createdBy",
    select: "firstName lastName email",
  },
  {
    // Populate updatedBy with specific fields
    path: "updatedBy",
    select: "firstName lastName email",
  },
  {
    // Populate items.productMeasureUnit and its nested references
    path: "items.productMeasureUnit",
    populate: [
      {
        path: "product",
        select: "name description",
      },
      {
        path: "measureUnit",
        select: "label description",
      },
    ],
  },
  {
    path: "deliveries",
    populate: populateDeliveryArray,
    options: { virtuals: true },
  },
];

router.get(
  "/",
  authorizeJwt,
  verifyAccount([{ name: "order", action: "read" }]),
  async (req, res) => {
    const filter = {};
    const search = req.query.search;
    const status = req.query.status;

    if (status) {
      filter.status = status.toUpperCase();
    }

    if (search) {
      filter.$or = [
        { reference: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { status: { $regex: search, $options: "i" } },
      ];
    }

    try {
      const orders = await Order.find(filter).populate(populateArray);

      res.status(200).json(orders);
    } catch (error) {
      console.log(error.message);
      res.status(500).json({ message: error.message });
    }
  },
);

router.get(
  "/:id",
  authorizeJwt,
  verifyAccount([{ name: "order", action: "read" }]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const order = await Order.findById(id).populate(populateArray);

      if (!order) {
        return res
          .status(404)
          .json({ message: `Cannot find any Commande with ID ${id}` });
      }

      res.status(200).json(order);
    } catch (error) {
      console.log(error.message);
      res.status(500).json({ message: error.message });
    }
  },
);

router.post(
  "/",
  authorizeJwt,
  verifyAccount([{ name: "order", action: "create" }]),
  async (req, res) => {
    try {
      const id = new mongoose.Types.ObjectId();
      // Generate unique reference for the order
      const reference = generateReference({
        data: id.toString(),
        prefix: "COM",
        length: 7,
      }); // You'll need to implement this function

      // Validate dates
      const startDate = new Date(req.body.startDate);
      const endDate = new Date(req.body.endDate);

      if (endDate < startDate) {
        return res.status(400).json({
          message: "End date must be after start date",
        });
      }

      // Validate items array
      if (
        !req.body.items ||
        !Array.isArray(req.body.items) ||
        req.body.items.length === 0
      ) {
        return res.status(400).json({
          message: "Order must contain at least one item",
        });
      }

      // Calculate total amount for each item and validate product measure units
      for (const item of req.body.items) {
        const productMeasureUnit = await ProductMeasureUnit.findById(
          item.productMeasureUnit,
        );
        if (!productMeasureUnit) {
          return res.status(404).json({
            message: `ProductMeasureUnit with ID ${item.productMeasureUnit} not found`,
          });
        }

        // Here you might want to add your pricing calculation logic
        // item.totalAmount = ... calculate based on your business logic
      }

      // Validate client exists
      const clientInfo = await User.findById(req.body.client);
      if (!clientInfo) {
        return res.status(404).json({
          message: `Client with ID ${req.body.client} not found`,
        });
      }

      // Create the order
      const orderData = {
        ...req.body,
        _id: id,
        reference,
        status: ORDER_STATUS.INITIATED,
        createdBy: req.user._id, // Assuming the authenticated user ID is in req.user.id
      };

      const newOrder = await Order.create(orderData);

      // Send SMS notification
      try {
        const phoneNumber = `${clientInfo.phone.toString()}`;
        const myMessage = `Votre commande avec la référence: ${newOrder.reference} est enregistrée.\nLe statut de votre commande est: ${newOrder.status}`;

        await sendMsg(phoneNumber, myMessage);
        console.log("SMS sent successfully");
      } catch (smsError) {
        console.error("SMS sending failed:", smsError);
        // Don't fail the request if SMS fails
      }

      // Populate necessary fields for response
      const populatedOrder = await Order.findById(newOrder._id)
        .populate("client", "name phone email") // Add fields you want to populate
        .populate("createdBy", "name")
        .populate({
          path: "items.productMeasureUnit",
          populate: {
            path: "product",
            model: "Product",
          },
        });

      res.status(201).json(populatedOrder);
    } catch (error) {
      console.error("Order creation failed:", error);
      res.status(500).json({
        message: "Failed to create order",
        error: error.message,
      });
    }
  },
);

router.put(
  "/:id",
  authorizeJwt,
  verifyAccount([{ name: "order", action: "update" }]),
  async (req, res) => {
    try {
      const orderId = req.params.id;

      // Find the existing order
      const existingOrder = await Order.findById(orderId);
      if (!existingOrder) {
        return res.status(404).json({
          message: `Order with ID ${orderId} not found`,
        });
      }

      // Prevent updates if order is FINISHED or CANCELED
      if (
        existingOrder.status === ORDER_STATUS.FINISHED ||
        existingOrder.status === ORDER_STATUS.CANCELED
      ) {
        return res.status(400).json({
          message: `Cannot update order in ${existingOrder.status} status`,
        });
      }

      // Validate dates if they're being updated
      if (req.body.startDate && req.body.endDate) {
        const startDate = new Date(req.body.startDate);
        const endDate = new Date(req.body.endDate);

        if (endDate < startDate) {
          return res.status(400).json({
            message: "End date must be after start date",
          });
        }
      }

      // If updating items, validate them
      if (req.body.items) {
        if (!Array.isArray(req.body.items) || req.body.items.length === 0) {
          return res.status(400).json({
            message: "Order must contain at least one item",
          });
        }

        // Validate each product measure unit exists
        for (const item of req.body.items) {
          const productMeasureUnit = await ProductMeasureUnit.findById(
            item.productMeasureUnit,
          );
          if (!productMeasureUnit) {
            return res.status(404).json({
              message: `ProductMeasureUnit with ID ${item.productMeasureUnit} not found`,
            });
          }
        }
      }

      // If client is being updated, validate new client exists
      if (req.body.client) {
        const clientInfo = await User.findById(req.body.client);
        if (!clientInfo) {
          return res.status(404).json({
            message: `Client with ID ${req.body.client} not found`,
          });
        }
      }

      // Add updatedBy to the request body
      const updateData = {
        ...req.body,
        updatedBy: req.user.id,
      };

      // Update the order
      const updatedOrder = await Order.findByIdAndUpdate(orderId, updateData, {
        new: true, // Return the updated document
        runValidators: true, // Run model validators
      }).populate([
        {
          path: "client",
          select: "name phone email",
        },
        {
          path: "createdBy",
          select: "name",
        },
        {
          path: "updatedBy",
          select: "name",
        },
        {
          path: "items.productMeasureUnit",
          populate: {
            path: "product",
            model: "Product",
          },
        },
      ]);

      // If status changed to FINISHED, send SMS notification
      if (
        req.body.status === ORDER_STATUS.FINISHED &&
        existingOrder.status !== ORDER_STATUS.FINISHED
      ) {
        try {
          const clientInfo = await User.findById(updatedOrder.client);
          const phoneNumber = `${clientInfo.phone.toString()}`;
          const myMessage = `Votre commande avec la référence: ${updatedOrder.reference} est terminée.`;

          await sendMsg(phoneNumber, myMessage);
          console.log("SMS sent successfully");
        } catch (smsError) {
          console.error("SMS sending failed:", smsError);
        }
      }

      res.json(updatedOrder);
    } catch (error) {
      console.error("Order update failed:", error);
      res.status(500).json({
        message: "Failed to update order",
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

router.post(
  "/pay",
  authorizeJwt,
  verifyAccount([{ name: "order", action: "create" }]),
  async (req, res) => {
    const user = req.user;
    let { amount, network, phoneNumber, orderId } = req.body;
    let transactionResponse;
    const newTransactionId = new mongoose.Types.ObjectId();
    let transaction;

    try {
      if (!amount || !network || !phoneNumber || !orderId)
        return res
          .status(404)
          .json({ message: "Les données ne sont pas correctes" });

      const client = await User.findOne({
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        email: user.email,
      }).exec();

      const order = await Order.findOne({ _id: orderId }).exec();

      if (!client)
        return res.status(404).json({ message: "Le client n'existe pas" });

      if (!order)
        return res.status(404).json({ message: "La commande n'existe pas" });

      if (!client._id.equals(order.client))
        return res
          .status(404)
          .json({ message: "La commande n'existe pas pour ce client" });

      if (order.paymentStatus === "paid")
        return res
          .status(404)
          .json({ message: "La commande a déja été payé par mobile money" });

      transaction = await Transaction.findOne({ item: order }).exec();

      amount = Number(amount);
      network = network.toUpperCase();

      if (transaction) {
        if (transaction.status === "success")
          return res
            .status(404)
            .json({ message: "La commande a déja une transaction réussie" });
      } else {
        transaction = await Transaction.create({
          _id: newTransactionId,
          name: `Achat de ${order.trackingId}`,
          amount: amount,
          status: "pending",
          step: "1",
          transactionType: "order",
          client: client,
          transactionPhone: {
            network: network,
            value: phoneNumber,
          },
          item: order,
        });
      }

      const qosResponse = await qosService.makePayment(
        process.env.NODE_ENV === "development" ? "22967662166" : phoneNumber,
        process.env.NODE_ENV === "development" ? 1 : amount,
        network,
      );

      const processPayment = async () => {
        let qosTransactionResponse = await qosService.getTransactionStatus(
          qosResponse.data.transref,
          network,
        );

        transactionResponse = qosTransactionResponse.data;

        console.log(qosTransactionResponse.data.responsemsg);

        if (qosTransactionResponse.data.responsemsg !== "PENDING") {
          task.stop();
          switch (qosTransactionResponse.data.responsemsg) {
            case "SUCCESS":
            case "SUCCESSFUL":
              order.paymentStatus = "paid";
              transaction.status = "success";
              transaction.step = "2";

              await order.save();
              await transaction.save();

              return res.status(200).json({
                message: `Le paiement de la commande ${order.trackingId} a reussi`,
              });
            case "FAILED":
              transaction.status = "failed";
              await transaction.save();

              return res.status(400).json({
                message: "Le paiement a échoué",
              });
            default:
              transaction.status = "failed";
              await transaction.save();

              return res.status(400).json({
                message: "Le paiement a échoué",
              });
          }
        }
      };

      const task = cron.schedule("*/15 * * * * *", processPayment);

      setTimeout(async () => {
        if (transactionResponse.responsemsg === "PENDING") {
          task.stop();

          transaction.status = "failed";
          await transaction.save();

          return res.status(400).json({
            message: "Le paiement a pris trop de temps",
          });
        }
      }, 60000);
    } catch (error) {
      transaction.status = "failed";
      await transaction.save();

      console.error(error.message);
      res.status(500).json({ message: "Server Error" });
    }
  },
);

module.exports = router;
