const express = require("express");
const router = express.Router();

const ContactMessage = require("../models/contactMessage");

const mongoose = require("mongoose");
const {
  authorizeJwt,
  verifyAccount,
  authorizePublic,
} = require("../helpers/verifyAccount");
const rateLimit = require("express-rate-limit");
const transporter = require("../services/mail");

// 🛡️ Limite : max 3 messages / 5 minutes / IP
const contactLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 3,
  message: "Trop de messages envoyés. Réessayez plus tard.",
});

// POST
router.post(
  "/send",
  authorizePublic(process.env.PUBLIC_TOKEN),
  contactLimiter,

  async (req, res) => {
    const { name, email, number, category, message } = req.body;

    if (!name || !email || !number || !category || !message) {
      return res.status(400).json({ error: "Tous les champs sont requis." });
    }

    if (!message || message.trim().length < 20) {
      return res.status(400).json({
        error: "Le message doit contenir au moins 20 caractères.",
      });
    }

    try {
      await ContactMessage.create({ name, email, number, category, message });

      await transporter.sendMail({
        from: `"Formulaire Straca" <${process.env.EMAIL_USER}>`,
        //to: "contact@straca-sa.com",
        to: "kilianvitou1@gmail.com",

        subject: `📨 Nouveau message - ${category}`,
        html: `
        <h3>Message reçu via le site Straca</h3>
        <p><strong>Nom :</strong> ${name}</p>
        <p><strong>Email :</strong> ${email}</p>
        <p><strong>Téléphone :</strong> ${number}</p>
        <p><strong>Catégorie :</strong> ${category}</p>
        <p><strong>Message :</strong><br>${message.replace(/\n/g, "<br>")}</p>
      `,
      });

      await transporter.sendMail({
        from: `"Straca" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "📬 Confirmation de réception de votre message",
        html: `
        <p>Bonjour ${name},</p>
        <p>Nous avons bien reçu votre message concernant <strong>${category}</strong>.</p>
        <p>Notre équipe vous contactera rapidement si nécessaire.</p>
        <p>Merci de nous avoir contactés !</p>
        <br>
        <p>— L'équipe Straca</p>
        `,
      });

      res.json({ success: true, message: "Message bien envoyé." });
    } catch (err) {
      console.error("Erreur contact:", err);
      res
        .status(500)
        .json({ error: "Erreur serveur. Veuillez réessayer plus tard." });
    }
  },
);

module.exports = router;
