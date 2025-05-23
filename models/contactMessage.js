// backend/models/contactMessage.js
const mongoose = require("mongoose");

const contactMessageSchema = mongoose.Schema(
  {
    name: { type: String, required: true },
    email: {
      type: String,
      required: true,
      match:
        /[a-z0-9!#$%'*+/=?^_`{|}~-]+(?:\.[a-z09!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/,
    },
    number: { type: String, required: true },
    category: { type: String, required: true },
    message: { type: String, required: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model("ContactMessage", contactMessageSchema);
