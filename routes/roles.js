const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Role = require("../models/roleModel");
const { authorizeJwt, verifyAccount } = require("../helpers/verifyAccount");

// GET all roles
router.get(
  "/",
  authorizeJwt,
  verifyAccount([{ name: "role", action: "read" }]),
  async (req, res) => {
    try {
      const roles = await Role.find().populate("permissions");
      res.status(200).json(roles);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// GET role by id
router.get(
  "/:id",
  authorizeJwt,
  verifyAccount([{ name: "role", action: "read" }]),
  async (req, res) => {
    try {
      const role = await Role.findById(req.params.id).populate("permissions");
      if (!role) return res.status(404).json({ message: "Rôle introuvable" });
      res.status(200).json(role);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// PATCH activate/deactivate role (super_admin only, system roles cannot be deleted)
router.patch(
  "/:id/toggle",
  authorizeJwt,
  verifyAccount([{ name: "role", action: "update" }]),
  async (req, res) => {
    try {
      const role = await Role.findById(req.params.id);
      if (!role) return res.status(404).json({ message: "Rôle introuvable" });

      role.active = !role.active;
      await role.save();

      res.status(200).json(role);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// PUT update role permissions (super_admin only, cannot update system roles code/name)
router.put(
  "/:id",
  authorizeJwt,
  verifyAccount([{ name: "role", action: "update" }]),
  async (req, res) => {
    try {
      const role = await Role.findById(req.params.id);
      if (!role) return res.status(404).json({ message: "Rôle introuvable" });

      // Prevent changing identity fields on system roles
      const { code, isSystem, ...updatable } = req.body;

      const updated = await Role.findByIdAndUpdate(req.params.id, updatable, {
        new: true,
      }).populate("permissions");

      res.status(200).json(updated);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

module.exports = router;
