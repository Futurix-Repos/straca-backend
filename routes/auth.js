const express = require("express");
const router = express.Router();

const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

// Require and configure dotenv
require("dotenv").config();

const User = require("../models/userModel");
const Client = require("../models/clientModel");
const Employee = require("../models/employeeModel");

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
                  }
                );

                // If the user is successfully created, return a 201 Created status code
                console.log(result);

                // Check the user type and create a Client or Employee accordingly
                if (req.body.type === "client") {
                  const newClient = new Client({
                    _id: user._id,
                    email: user.email,
                    phone: user.phone,
                    lastName: req.body.lastName,
                    firstName: req.body.firstName,
                    address: req.body.address,
                    password: hash,
                  });

                  await newClient.save();
                } else if (req.body.type === "employee") {
                  const newEmployee = new Employee({
                    _id: user._id,
                    email: user.email,
                    phone: user.phone,
                    lastName: req.body.lastName,
                    firstName: req.body.firstName,
                    password: hash,
                    title: req.body.title,
                  });

                  await newEmployee.save();
                }

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
  // Check if the email exists in the database
  User.find({ email: req.body.email })
    .populate("permissions")
    .exec()
    .then((user) => {
      // If the email doesn't exist, return a 401 Unauthorized status code
      if (user.length < 1) {
        return res.status(400).json({
          message: `User with email ${req.body.email} not found`,
        });
      }
      // Compare the provided password with the hashed password stored in the database
      bcrypt.compare(req.body.password, user[0].password, (err, result) => {
        if (err) {
          // If there's an error during password comparison, return a 401 Unauthorized status code
          return res.status(400).json({
            message: "Auth failed",
          });
        }
        if (result) {
          // If the password matches, create a JWT token for authentication
          const token = jwt.sign(
            {
              email: user[0].email,
              userId: user[0]._id,
              type: user[0].type,
            },
            process.env.JWT_KEY, // Use environment variable for the secret key
            {
              expiresIn: "5h", // Token expiration time
            }
          );
          // Return a 200 OK status code with the token for successful authentication
          delete user[0].password;

          return res.status(200).json({
            message: "Auth successful",
            token: token,
            userId: user[0]._id,
            user: user[0],
          });
        }
        // If the password doesn't match, return a 401 Unauthorized status code
        res.status(400).json({
          message: "Incorrect email or password",
        });
      });
    })
    .catch((err) => {
      // If there's an error during the process, return a 500 Internal Server Error
      console.log(err);
      res.status(500).json({
        error: err,
      });
    });
});

module.exports = router;
