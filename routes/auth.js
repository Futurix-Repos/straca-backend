const express = require("express");
const router = express.Router();

const bcrypt = require('bcryptjs');
const jwt = require("jsonwebtoken");

// Require and configure dotenv
require("dotenv").config();

const User = require("../models/userModel");
const { authorizePublic } = require("../helpers/verifyAccount");

// NOTE SÉCURITÉ : l'ancien endpoint public `POST /auth/signup` a été supprimé.
// Il acceptait `type` depuis le body sans authentification, ce qui permettait à
// n'importe qui de créer un compte `type: "admin"`. La création d'utilisateurs
// passe désormais uniquement par les routes authentifiées (`POST /users`), où
// seuls les admins peuvent créer d'autres comptes.

router.post("/login", async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email }).populate({
      path: "role",
      populate: { path: "permissions" },
    });

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
