const express = require("express");
const router = express.Router();

const mongoose = require("mongoose");
const bcrypt = require('bcryptjs');
const jwt = require("jsonwebtoken");

// Require and configure dotenv
require("dotenv").config();

const User = require("../models/userModel");
const { authorizePublic } = require("../helpers/verifyAccount");

router.post("/signup", async (req, res) => {
  // Check if the email already exists in the database
  User.find({ email: req.body.email })
    .exec()
    .then((user) => {
      // If the email already exists, return a 409 Conflict status code
      if (user.length >= 1) {
        return res.status(409).json({
          message: `User with email ${req.body.email} exists`,
        });
      } else {
        // Hash the password before saving it in the database
        bcrypt.hash(req.body.password, 10, (err, hash) => {
          if (err) {
            // If there's an error during hashing, return a 500 Internal Server Error
            return res.status(500).json({
              error: err,
            });
          } else {
            // Create a new user with the hashed password
            const user = new User({
              _id: new mongoose.Types.ObjectId(),
              phone: req.body.phone,
              type: req.body.type,
              email: req.body.email,
              lastName: req.body.lastName,
              firstName: req.body.firstName,
              address: req.body.address,
              password: hash,
              confirmed: true,
            });
            // Save the new user in the database
            user
              .save()
              .then(async (result) => {
                const token = jwt.sign(
                  {
                    email: result.email,
                    userId: result._id,
                    type: result.type,
                  },
                  process.env.JWT_KEY, // Use environment variable for the secret key
                  {
                    expiresIn: "5h", // Token expiration time
                  },
                );

                // If the user is successfully created, return a 201 Created status code
                console.log(result);

                delete result.password;

                res.status(201).json({
                  message: `${req.body.type} User created`,
                  token: token,
                  user: result,
                });
              })
              .catch((err) => {
                console.log("Gotcha");
                // If there's an error during saving, return a 500 Internal Server Error
                console.log(err);
                res.status(500).json({
                  error: err,
                });
              });
          }
        });
      }
    });
});
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

module.exports = router;
