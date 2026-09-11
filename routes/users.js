const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const UserModel = require("../models/userModel");
const { authorizeJwt, verifyAccount } = require("../helpers/verifyAccount");

router.get(
  "/",
  authorizeJwt,
  verifyAccount([{ name: "user", action: "read" }]),
  async (req, res) => {
    const filter = {};
    const { search, type } = req.query;

    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { address: { $regex: search, $options: "i" } },
      ];
    }

    if (type && ["admin", "employee", "client"].includes(type)) {
      filter.type = type;
    }

    try {
      const users = await UserModel.find(filter)
        .select("-password")
        .populate({ path: "role", populate: { path: "permissions" } });
      res.status(200).json(users);
    } catch (error) {
      console.log(error.message);
      res.status(500).json({ message: error.message });
    }
  }
);

router.post(
  "/",
  authorizeJwt,
  verifyAccount([{ name: "user", action: "create" }]),
  async (req, res) => {
    try {
      const { password, ...rest } = req.body;
      const hashedPassword = await bcrypt.hash(password, 10);

      const user = await UserModel.create({
        _id: new mongoose.Types.ObjectId(),
        ...rest,
        password: hashedPassword,
        confirmed: true,
      });

      const populated = await UserModel.findById(user._id)
        .select("-password")
        .populate({ path: "role", populate: { path: "permissions" } });

      res.status(201).json(populated);
    } catch (error) {
      console.log(error.message);
      res.status(500).json({ message: error.message });
    }
  }
);

router.put(
  "/:id",
  authorizeJwt,
  verifyAccount([{ name: "user", action: "update" }]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { password, ...rest } = req.body;

      const updatePayload = { ...rest };
      if (password) {
        updatePayload.password = await bcrypt.hash(password, 10);
      }

      const user = await UserModel.findByIdAndUpdate(id, updatePayload, {
        new: true,
      })
        .select("-password")
        .populate({ path: "role", populate: { path: "permissions" } });

      if (!user) {
        return res.status(404).json({ message: `User ${id} not found` });
      }
      res.status(200).json(user);
    } catch (error) {
      console.log(error.message);
      res.status(500).json({ message: error.message });
    }
  }
);

router.delete(
  "/:id",
  authorizeJwt,
  verifyAccount([{ name: "user", action: "delete" }]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const user = await UserModel.findByIdAndDelete(id);
      if (!user) {
        return res.status(404).json({ message: `User ${id} not found` });
      }
      res.status(200).json({ message: "Utilisateur supprimé" });
    } catch (error) {
      console.log(error.message);
      res.status(500).json({ message: error.message });
    }
  }
);

module.exports = router;
