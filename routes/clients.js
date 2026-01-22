const express = require("express");
const router = express.Router();
const User = require("../models/userModel");
const {
  authorizeJwt,
  verifyAccount,
  authorizePublic,
} = require("../helpers/verifyAccount");
const bcrypt = require('bcryptjs');
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const Delivery = require("../models/deliveryModel");
const Order = require("../models/orderModel");

router.get(
  "/",
  authorizeJwt,
  verifyAccount([{ name: "client", action: "read" }]),
  async (req, res) => {
    const filter = { type: "client" };
    const search = req.query.search;

    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        // { address: { $regex: search, $options: "i" } },
      ];
    }

    try {
      const clients = await User.find(filter).select("-password");
      res.status(200).json(clients);
    } catch (error) {
      console.log(error.message);
      res.status(500).json({ message: error.message });
    }
  },
);

router.get(
  "/stats",
  authorizeJwt,
  verifyAccount([{ name: "client", action: "read" }]),
  async (req, res) => {
    try {
      const allStatuses = ["INITIATED", "IN_PROGRESS", "COMPLETED", "CANCELED"]; // Add all possible statuses

      const stats = await Order.aggregate([
        { $match: { client: req.user._id } },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
            totalAmount: { $sum: "$totalAmount" },
          },
        },
        {
          $project: {
            status: "$_id",
            count: 1,
            totalAmount: 1,
            _id: 0,
          },
        },
      ]);

      const completeStats = allStatuses.map((status) => {
        const found = stats.find((s) => s.status === status);
        return found || { status, count: 0, totalAmount: 0 };
      });

      res.json(completeStats);
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  },
);

router.get(
  "/:id",
  authorizeJwt,
  verifyAccount([{ name: "client", action: "read" }]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const client = await User.findById(id).select("-password");

      if (!client) {
        return res
          .status(404)
          .json({ message: `Client with ID ${id} not found` });
      }

      res.status(200).json(client);
    } catch (error) {
      console.log(error.message);
      res.status(500).json({ message: error.message });
    }
  },
);

router.post("/login", async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email }).populate(
      "permissions",
    );

    if (!user) {
      return res.status(400).json({
        message: `User with email ${req.body.email} not found`,
      });
    }

    const isValid = await bcrypt.compare(req.body.password, user.password);

    if (!isValid)
      return res.status(400).json({ message: "Mot de passe incorrect" });

    if (!user.confirmed)
      return res.status(400).json({ message: "Utilisateur non confirmé" });

    if (user.type !== "client")
      return res
        .status(400)
        .json({ message: "Vous ne pouvez pas accéder a cette page" });

    const token = jwt.sign(
      {
        email: user.email,
        userId: user._id,
        type: user.type,
      },
      process.env.JWT_KEY, // Use environment variable for the secret key
      {
        expiresIn: "24h", // Token expiration time
      },
    );

    delete user.password;
    delete user.permissions;

    return res.status(200).json({
      message: "Auth successful",
      token: token,
      user: user,
    });
  } catch (e) {
    console.log(e);
    return res.status(500).json({ message: "Erreur de serveur" });
  }
});

router.post("/register", async (req, res) => {
  // Check if the email already exists in the database

  try {
    const user = await User.findOne({ email: req.body.email });

    if (user) {
      return res.status(400).json({
        message: `Un utilisateur avec cet email existe déja`,
      });
    }

    let hashedPassword = await bcrypt.hash(req.body.password, 10);

    const newUserId = new mongoose.Types.ObjectId();
    const newUser = new User({
      _id: newUserId,
      phone: req.body.phone,
      type: "client",
      email: req.body.email,
      lastName: req.body.lastName,
      firstName: req.body.firstName,
      ...(req.body.address && {
        address: req.body.address,
      }),
      password: hashedPassword,
    });

    newUser.save();

    delete newUser.password;
    delete newUser.permissions;

    return res.status(201).json({
      message: `User created`,
      user: newUser,
    });
  } catch (e) {}
});

router.post(
  "/",
  authorizeJwt,
  verifyAccount([{ name: "client", action: "create" }]),
  async (req, res) => {
    try {
      const newId = new mongoose.Types.ObjectId();
      let hashedPassword = await bcrypt.hash(req.body.password, 10);

      const body = {
        ...req.body,
        _id: newId,
        password: hashedPassword,
        type: "client",
        confirmed: true,
      };

      const client = await User.create(body);
      res.status(201).json(client);
    } catch (error) {
      console.log(error.message);
      res.status(500).json({ message: error.message });
    }
  },
);

router.put(
  "/:id",
  authorizeJwt,
  verifyAccount([{ name: "client", action: "update" }]),
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

      const client = await User.findByIdAndUpdate(id, body, {
        new: true,
      });
      if (!client) {
        return res
          .status(404)
          .json({ message: `Cannot find any client with ID ${id}` });
      }
      res.status(200).json(client);
    } catch (error) {
      console.log(error.message);
      res.status(500).json({ message: error.message });
    }
  },
);

router.put(
  "/activate/:id",
  authorizeJwt,
  verifyAccount([{ name: "client", action: "update" }]),
  async (req, res) => {
    try {
      const { id } = req.params;

      const client = await User.findByIdAndUpdate(
        id,
        { confirmed: true },
        {
          new: true,
        },
      );
      if (!client) {
        return res
          .status(404)
          .json({ message: `Cannot find any client with ID ${id}` });
      }
      res.status(200).json(client);
    } catch (error) {
      console.log(error.message);
      res.status(500).json({ message: error.message });
    }
  },
);

router.delete(
  "/:id",
  authorizeJwt,
  verifyAccount([{ name: "client", action: "delete" }]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const client = await User.findByIdAndDelete(id);
      if (!client) {
        return res
          .status(404)
          .json({ message: `Cannot find any client with ID ${id}` });
      }
      res.status(200).json(client);
    } catch (error) {
      console.log(error.message);
      res.status(500).json({ message: error.message });
    }
  },
);

module.exports = router;
