const express = require("express");
const router = express.Router();
const User = require("../models/userModel");
const {
  authorizeJwt,
  verifyAccount,
  authorizePublic,
} = require("../helpers/verifyAccount");
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");

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
