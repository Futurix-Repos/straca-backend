const express = require("express");
const router = express.Router();

const mongoose = require("mongoose");
const Order = require("../models/orderModel");
const User = require("../models/userModel");

router.get("/", async (req, res) => {
  const orders = await Order.find();
  const clients = await User.find({ type: "client" });
  const deliveredOrders = await Order.find({ status: "Commande Arrivée" });

  const myData = {
    totalColis: orders.length,
    totalClients: clients.length,
    totalColisDelivered: deliveredOrders.length,
  };
  res.status(200).json(myData);
});

module.exports = router;
