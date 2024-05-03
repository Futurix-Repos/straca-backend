const express = require('express');
const router = express.Router();
const PermissionModel = require('../models/permissionModel');
const mongoose = require("mongoose");
const {authorizeJwt, verifyAccount} = require("../helpers/verifyAccount"); // Import the Pricing model

// GET all permissions
router.get('/', authorizeJwt, verifyAccount([{name: 'permission', action: "read"}]),async (req, res) => {

  const filter = {};
  const search = req.query.search;

  if (search) {
    filter.$or = [
      { description: { $regex: search, $options: "i" } },
      { name: { $regex: search, $options: "i" } },
    ];

  }

  try {
    const permissions = await PermissionModel.find(filter);
    res.status(200).json(permissions);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;