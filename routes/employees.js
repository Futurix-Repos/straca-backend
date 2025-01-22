const express = require("express");
const router = express.Router();
const User = require("../models/userModel");
const { authorizeJwt, verifyAccount } = require("../helpers/verifyAccount");
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const Order = require("../models/orderModel");
const Delivery = require("../models/deliveryModel");

router.get(
  "/",
  authorizeJwt,
  verifyAccount([{ name: "employee", action: "read" }]),
  async (req, res) => {
    const filter = { type: "employee" };
    const search = req.query.search;

    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { address: { $regex: search, $options: "i" } },
      ];
    }

    try {
      const employees = await User.find(filter).select("-password");
      res.status(200).json(employees);
    } catch (error) {
      console.log(error.message);
      res.status(500).json({ message: error.message });
    }
  },
);

router.get(
  "/me",
  authorizeJwt,
  verifyAccount([{ name: "employee", action: "read" }]),
  async (req, res) => {
    try {
      const id = req.user._id.toString();
      const employee = await User.findById(id).select("-password");

      if (!employee) {
        return res
          .status(404)
          .json({ message: `Employee with ID ${id} not found` });
      }

      res.status(200).json(employee);
    } catch (error) {
      console.log(error.message);
      res.status(500).json({ message: error.message });
    }
  },
);

router.get(
  "/stats",
  authorizeJwt,
  verifyAccount([{ name: "employee", action: "read" }]),
  async (req, res) => {
    try {
      const userId = req.user._id;

      const [statusCounts, recentOrders] = await Promise.all([
        // Get delivery counts
        Delivery.aggregate([
          {
            $match: {
              $or: [{ "sender.user": userId }, { "receiver.user": userId }],
            },
          },
          // Lookup for sender.user
          {
            $lookup: {
              from: "users",
              localField: "sender.user",
              foreignField: "_id",
              pipeline: [
                {
                  $project: {
                    firstName: 1,
                    lastName: 1,
                    email: 1,
                    telephone: 1,
                  },
                },
              ],
              as: "sender.userDetails",
            },
          },
          {
            $unwind: {
              path: "$sender.userDetails",
              preserveNullAndEmptyArrays: true,
            },
          },

          // Lookup for receiver.user
          {
            $lookup: {
              from: "users",
              localField: "receiver.user",
              foreignField: "_id",
              pipeline: [
                {
                  $project: {
                    firstName: 1,
                    lastName: 1,
                    email: 1,
                    telephone: 1,
                  },
                },
              ],
              as: "receiver.userDetails",
            },
          },
          {
            $unwind: {
              path: "$receiver.userDetails",
              preserveNullAndEmptyArrays: true,
            },
          },

          // Lookup for productMeasureUnit and its nested product
          {
            $lookup: {
              from: "productmeasureunits",
              localField: "productMeasureUnit",
              foreignField: "_id",
              pipeline: [
                {
                  $lookup: {
                    from: "products",
                    localField: "product",
                    foreignField: "_id",
                    pipeline: [{ $project: { name: 1, description: 1 } }],
                    as: "product",
                  },
                },
                {
                  $unwind: {
                    path: "$product",
                    preserveNullAndEmptyArrays: true,
                  },
                },
                {
                  $lookup: {
                    from: "measureunits",
                    localField: "measureUnit",
                    foreignField: "_id",
                    pipeline: [{ $project: { label: 1, description: 1 } }],
                    as: "measureUnit",
                  },
                },
                {
                  $unwind: {
                    path: "$measureUnit",
                    preserveNullAndEmptyArrays: true,
                  },
                },
              ],
              as: "productMeasureUnitDetails",
            },
          },
          {
            $unwind: {
              path: "$productMeasureUnitDetails",
              preserveNullAndEmptyArrays: true,
            },
          },

          // Lookup for vehicle
          {
            $lookup: {
              from: "vehicles",
              localField: "vehicle",
              foreignField: "_id",
              pipeline: [{ $project: { name: 1, registrationNumber: 1 } }],
              as: "vehicleDetails",
            },
          },
          {
            $unwind: {
              path: "$vehicleDetails",
              preserveNullAndEmptyArrays: true,
            },
          },

          // Lookup for departureAddress
          {
            $lookup: {
              from: "locations",
              localField: "departureAddress",
              foreignField: "_id",
              pipeline: [{ $project: { label: 1, description: 1 } }],
              as: "departureAddressDetails",
            },
          },
          {
            $unwind: {
              path: "$departureAddressDetails",
              preserveNullAndEmptyArrays: true,
            },
          },

          // Finally, group by status
          {
            $group: {
              _id: "$status",
              count: { $sum: 1 },
            },
          },
        ]),

        // Get recent orders with populated fields
        Order.find()
          .sort({ createdAt: -1 })
          .limit(10)
          .populate({
            path: "client",
            select: "firstName lastName email telephone", // Select specific fields
          })
          .populate({
            path: "createdBy",
            select: "firstName lastName email", // Select specific fields
          })
          .populate({
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
          })
          .populate({
            path: "deliveries",
            select: "status sender receiver",
            populate: [
              {
                path: "sender.user",
                select: "firstName lastName",
              },
              {
                path: "receiver.user",
                select: "firstName lastName",
              },
            ],
          }),
      ]);

      // Initialize result with 0 counts
      const result = {
        pendingDeliveries: 0,
        inProgressDeliveries: 0,
        deliveredDeliveries: 0,
        canceledDeliveries: 0,
        recentOrders,
      };

      // Map status counts to result properties
      statusCounts.forEach((status) => {
        switch (status._id) {
          case "PENDING":
            result.pendingDeliveries = status.count;
            break;
          case "IN_PROGRESS":
            result.inProgressDeliveries = status.count;
            break;
          case "DELIVERED":
            result.deliveredDeliveries = status.count;
            break;
          case "CANCELED":
            result.canceledDeliveries = status.count;
            break;
        }
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.log(error.message);
      res.status(500).json({ message: error.message });
    }
  },
);

router.post(
  "/",
  authorizeJwt,
  verifyAccount([{ name: "employee", action: "create" }]),
  async (req, res) => {
    try {
      const newId = new mongoose.Types.ObjectId();

      let hashedPassword = await bcrypt.hash(req.body.password, 10);

      const body = {
        ...req.body,
        _id: newId,
        password: hashedPassword,
        type: "employee",
        confirmed: true,
      };

      const employee = await User.create(body);
      res.status(201).json(employee);
    } catch (error) {
      console.log(error.message);
      res.status(500).json({ message: error.message });
    }
  },
);

router.put(
  "/:id",
  authorizeJwt,
  verifyAccount([{ name: "employee", action: "update" }]),
  async (req, res) => {
    try {
      const { id } = req.params;

      const { confirmed, type, ...filteredBody } = req.body;

      let hashedPassword = req.body.password
        ? await bcrypt.hash(req.body.password, 10)
        : null;

      const body = {
        ...filteredBody,
        ...(hashedPassword && { password: hashedPassword }),
      };

      const employee = await User.findByIdAndUpdate(id, body, {
        new: true,
      });
      if (!employee) {
        return res
          .status(404)
          .json({ message: `Cannot find any employee with ID ${id}` });
      }
      res.status(200).json(employee);
    } catch (error) {
      console.log(error.message);
      res.status(500).json({ message: error.message });
    }
  },
);

router.get(
  "/:id",
  authorizeJwt,
  verifyAccount([{ name: "employee", action: "read" }]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const employee = await User.findById(id).select("-password");

      if (!employee) {
        return res
          .status(404)
          .json({ message: `Employee with ID ${id} not found` });
      }

      res.status(200).json(employee);
    } catch (error) {
      console.log(error.message);
      res.status(500).json({ message: error.message });
    }
  },
);

router.delete(
  "/:id",
  authorizeJwt,
  verifyAccount([{ name: "employee", action: "delete" }]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const employee = await User.findByIdAndDelete(id);
      if (!employee) {
        return res
          .status(404)
          .json({ message: `Cannot find any employee with ID ${id}` });
      }
      res.status(200).json(employee);
    } catch (error) {
      console.log(error.message);
      res.status(500).json({ message: error.message });
    }
  },
);

module.exports = router;
