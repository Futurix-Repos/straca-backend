const express = require("express");
const router = express.Router();

const ProductMeasureUnit = require("../models/productMeasureUnitModel");
const Transaction = require("../models/transactionModel");
const mongoose = require("mongoose");
const { authorizeJwt, verifyAccount } = require("../helpers/verifyAccount");
const User = require("../models/userModel"); // Import the Pricing model
const qosService = require("../helpers/qosHelper");
const cron = require("node-cron");

// GET all products
router.get(
  "/",
  authorizeJwt,
  verifyAccount([{ name: "productMeasureUnit", action: "read" }]),
  async (req, res) => {
    const filter = {};
    const search = req.query.search;

    if (search) {
      filter.$or = [
        {
          $or: [
            { "product.name": { $regex: search, $options: "i" } },
            { "product.description": { $regex: search, $options: "i" } },
          ],
        },

        // Search in MeasureUnit fields
        {
          $or: [
            { "measureUnit.label": { $regex: search, $options: "i" } },
            { "measureUnit.description": { $regex: search, $options: "i" } },
          ],
        },
      ];

      if (!isNaN(Number(search))) {
        filter["$or"].push({ amount: { $eq: Number(search) } });
      }
    }

    try {
      const products = await ProductMeasureUnit.find(filter).populate([
        {
          path: "measureUnit",
        },
        {
          path: "product",
        },
      ]);
      res.status(200).json(products);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: "Server Error" });
    }
  },
);

// GET a product by ID
router.get(
  "/:id",
  authorizeJwt,
  verifyAccount([{ name: "productMeasureUnit", action: "read" }]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const product = await ProductMeasureUnit.findById(id).populate([
        {
          path: "measureUnit",
        },
        {
          path: "product",
          populate: {
            path: "measureUnits",
            select: ["measureUnit"],
            populate: {
              path: "measureUnit",
            },
          },
        },
      ]);
      if (!product) {
        return res
          .status(404)
          .json({ message: `Cannot find any Product with ID ${id}` });
      }
      res.status(200).json(product);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: "Server Error" });
    }
  },
);

// Create a new product
router.post(
  "/",
  authorizeJwt,
  verifyAccount([{ name: "productMeasureUnit", action: "create" }]),
  async (req, res) => {
    req.body._id = new mongoose.Types.ObjectId();

    try {
      const newProduct = await ProductMeasureUnit.create(req.body);

      res.status(201).json(newProduct);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: "Server Error" });
    }
  },
);

// Update a product by ID
router.put(
  "/:id",
  authorizeJwt,
  verifyAccount([{ name: "productMeasureUnit", action: "update" }]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const product = await ProductMeasureUnit.findByIdAndUpdate(id, req.body, {
        new: true,
      });
      if (!product) {
        return res
          .status(404)
          .json({ message: `Cannot find any Product Measure with ID ${id}` });
      }

      res.status(200).json(product);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: "Server Error" });
    }
  },
);

// Delete a product by ID
router.delete(
  "/:id",
  authorizeJwt,
  verifyAccount([{ name: "productMeasureUnit", action: "delete" }]),
  async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { id } = req.params;

      // Delete the product measure
      await ProductMeasureUnit.findByIdAndDelete(id, { session });

      await session.commitTransaction();
      session.endSession();

      res.status(200).json({ message: "Product Measure deleted successfully" });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      console.error(error.message);
      res.status(500).json({ message: "Server Error" });
    }
  },
);

router.post(
  "/pay",
  authorizeJwt,
  verifyAccount([{ name: "product", action: "create" }]),
  async (req, res) => {
    const user = req.user;
    let { amount, network, phoneNumber, productId, quantity } = req.body;
    let transactionResponse;
    const newTransactionId = new mongoose.Types.ObjectId();

    try {
      if (!amount || !network || !phoneNumber || !productId || !quantity)
        return res
          .status(404)
          .json({ message: "Les données ne sont pas correctes" });

      const client = await User.findOne({
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        email: user.email,
      }).exec();

      const product = await Product.findOne({ _id: productId }).exec();

      if (!client)
        return res.status(404).json({ message: "Le client n'existe pas" });

      if (!product)
        return res.status(404).json({ message: "Le produit n'existe pas" });

      if (product.quantity == 0 || quantity > Number(product.quantity))
        return res
          .status(404)
          .json({ message: "La quantité du produit n'est pas suffisante" });

      amount = Number(amount);
      network = network.toUpperCase();

      const newTransaction = await Transaction.create({
        _id: newTransactionId,
        name: `Achat de ${product.name}`,
        amount: amount,
        status: "pending",
        transactionType: "product",
        client: client,
        transactionPhone: {
          network: network,
          value: phoneNumber,
        },
        item: product,
      });

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
              const productQuantity = Number(product.quantity);

              product.quantity = productQuantity - quantity;
              newTransaction.status = "success";
              newTransaction.step = "2";

              await product.save();
              await newTransaction.save();

              return res.status(200).json({
                message: `Le paiement de ${product.name} a reussi`,
              });
            case "FAILED":
              newTransaction.status = "failed";
              await newTransaction.save();

              return res.status(400).json({
                message: "Le paiement a échoué",
              });
            default:
              newTransaction.status = "failed";
              await newTransaction.save();

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

          newTransaction.status = "failed";
          await newTransaction.save();

          return res.status(400).json({
            message: "Le paiement a pris trop de temps",
          });
        }
      }, 60000);
    } catch (error) {
      const transaction = await Transaction.findOne({
        _id: newTransactionId,
      }).exec();

      if (transaction) {
        transaction.status = "failed";
        await transaction.save();
      }

      console.error(error.message);
      res.status(500).json({ message: "Server Error" });
    }
  },
);

module.exports = router;
