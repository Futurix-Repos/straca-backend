const express = require("express");
const newsLetter = require("../models/newsletter");
const router = express.Router();
const mongoose = require("mongoose");
const { authorizePublic } = require("../helpers/verifyAccount");

//create a newsLetter
router.post(
  "/subscribe",
  authorizePublic(process.env.PUBLIC_TOKEN),
  async (req, res) => {
    try {
      const { email } = req.body;

      if (!email || email.trim() === "") {
        return res.status(400).json({ message: "L'email est requis." });
      }

      const existingEmail = await newsLetter.findOne({ email });
      if (existingEmail) {
        return res.status(400).json({ message: "Cet email existe déjà." });
      }

      const newId = new mongoose.Types.ObjectId();
      const newEmail = await newsLetter.create({ _id: newId, email });
      res.status(201).json(newEmail);
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: "Erreur interne" });
    }
  },
);
module.exports = router;
