const express = require('express');
const router = express.Router();
const Commande = require('../models/commandeModel');
const Client = require('../models/clientModel');
const Pricing = require('../models/pricingModel');

const { sendMsg } = require('../helpers/fasterMessageHelper');
const {authorizeJwt, verifyAccount} = require("../helpers/verifyAccount");
const mongoose = require("mongoose");
const Product = require("../models/productModel");
const Transaction = require("../models/transactionModel");
const qosService = require("../helpers/qosHelper");
const cron = require("node-cron");

router.get('/', authorizeJwt, verifyAccount([{name: 'commande', action: "read"}]), async (req, res) => {

  const filter = {};
  const search = req.query.search;

  if (search) {
    filter.$or = [
      { trackingId: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
      { pays: { $regex: search, $options: "i" } },
      { ville: { $regex: search, $options: "i" } },
      { status: { $regex: search, $options: "i" } },
      { specialNote: { $regex: search, $options: "i" } },
    ];
  }

  try {
    const commandes = await Commande.find(filter)
      .populate('client', 'lastName firstName email phone address')
      .populate({
        path: 'pricing',
        populate: {
          path: 'typeColis transportType unit',
          select: 'label description', // select specific fields to populate
        },
      })
      .populate('unit typeColis transportType', '_id label description');

    res.status(200).json(commandes);
  } catch (error) {
    console.log(error.message);
    res.status(500).json({ message: error.message });
  }
});

router.get('/my', authorizeJwt, verifyAccount([{name: 'commande', action: "read"}]), async (req, res) => {

  const user = req.user
  const filter = {};
  const search = req.query.search;

  if (search) {
    filter.$or = [
      { trackingId: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
      { pays: { $regex: search, $options: "i" } },
      { ville: { $regex: search, $options: "i" } },
      { status: { $regex: search, $options: "i" } },
      { specialNote: { $regex: search, $options: "i" } },
    ];
  }

  try {

    const client = await Client.findOne({firstName: user.firstName , lastName: user.lastName, phone: user.phone, email: user.email}).exec();

    if (client) {
      filter.client = client._id;
    }

    const commandes = await Commande.find(filter)
        .populate('client', 'lastName firstName email phone address')
        .populate({
          path: 'pricing',
          populate: {
            path: 'typeColis transportType unit',
            select: 'label description', // select specific fields to populate
          },
        })
        .populate('unit typeColis transportType', '_id label description');


    res.status(200).json(commandes);
  } catch (error) {
    console.log(error.message);
    res.status(500).json({ message: error.message });
  }
});

router.get('/:id', authorizeJwt, verifyAccount([{name: 'commande', action: "read"}]),async (req, res) => {
  try {
    const { id } = req.params;
    const commande = await Commande.findById(id)
      .populate('client', 'lastName firstName email phone address')
      .populate('unit');

    if (!commande) {
      return res.status(404).json({ message: `Cannot find any Commande with ID ${id}` });
    }
    res.status(200).json(commande);
  } catch (error) {
    console.log(error.message);
    res.status(500).json({ message: error.message });
  }
});

router.post('/', authorizeJwt, verifyAccount([{name: 'commande', action: "create"}]), async (req, res) => {
  try {
    // get pricing
    const pricing = await Pricing.findOne({ typeColis: req.body.typeColis, transportType: req.body.transportType, unit: req.body.unit })

    const updatedRequestBody = { ...req.body };

    if (pricing) {
      // Create a copy of req.body and update the copied object
      updatedRequestBody.pricing = pricing._id;

      // console.log(`==Omo2==> ${updatedRequestBody.pricing}`);
    } else {
      return res.status(404).json({ message: `Could NOT find Pricing for specified unit, typeColis and transportType` });
    }

    const newCommande = await Commande.create(updatedRequestBody);

    // Fetch the client information using the client ID from newCommande
    const clientInfo = await Client.findById(newCommande.client);

    if (!clientInfo) {
      return res.status(404).json({ message: `Client with ID ${newCommande.client} not found` });
    }

    // handle sendSMS
    {
      // Get the phone number from the updatedCommande or pass it as part of the request body
      const phoneNumber = `229${clientInfo.phone.toString()}`; // Replace with your field name
      console.log(`Client Phone => ${phoneNumber}`)



      const myMessage = `Votre commande du tracking id: ${newCommande.trackingId.toString()} est enregistrée.\nLe statut de votre commande est: ${newCommande.status.toString()}`;

      console.log(phoneNumber)
      console.log(myMessage)
      // Call the function to send SMS
      sendMsg(phoneNumber, myMessage).then((response) => {
        console.log("sms envoyé");
      }).catch((e) => {
        console.log("une erreur est survenue dans l'envoie du sms");
        console.log(e);
      }); // Customize your SMS message
    }

    res.status(201).json(newCommande);
  } catch (error) {
    console.log(error.message);
    res.status(500).json({ message: error.message });
  }
});

router.put('/:id', authorizeJwt, verifyAccount([{name: 'commande', action: "update"}]), async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch the initial Commande from the database
    const initialCommande = await Commande.findById(id).populate('client');
    if (!initialCommande) {
      return res.status(404).json({ message: `Cannot find any Commande with ID ${id}` });
    }

    // Store the initial status
    const initialStatus = initialCommande.status;

    // Update the Commande and get the updated version
    const updatedCommande = await Commande.findByIdAndUpdate(id, req.body, { new: true, runValidators: true }).populate('client');
    if (!updatedCommande) {
      return res.status(404).json({ message: `Cannot find any Commande with ID ${id}` });
    }

    // Fetch the client information using the client ID from updatedComande
    const clientInfo = await Client.findById(updatedCommande.client);

    if (!clientInfo) {
      return res.status(404).json({ message: `Client with ID ${updatedCommande.client} not found` });
    }

    // Compare the initial status with the updated status
    if (initialStatus !== updatedCommande.status) {
      console.log(`StatusChanges? => from ${initialStatus} to ${updatedCommande.status}`);
      // handle sendSMS
      {
        // Get the phone number from the updatedCommande or pass it as part of the request body
        const phoneNumber = `229${clientInfo.phone.toString()}`; // Replace with your field name
        console.log(`Client Phone => ${phoneNumber}`)



        const myMessage = `Votre commande du tracking id: ${updatedCommande.trackingId.toString()} est enregistrée.\nLe statut de votre commande est: ${updatedCommande.status.toString()}`;

        console.log(phoneNumber)
        console.log(myMessage)
        // Call the function to send SMS
        sendMsg(phoneNumber, myMessage).then((response) => {
          console.log("sms envoyé");
        }).catch((e) => {
          console.log("une erreur est survenue dans l'envoie du sms");
          console.log(e);
        });  // Customize your SMS message
      }
    } else {
      console.log('Status was not changed')
    }

    res.status(200).json(updatedCommande);
  } catch (error) {
    console.log(error.message);
    res.status(500).json({ message: error.message });
  }
});

router.delete('/:id', authorizeJwt, verifyAccount([{name: 'commande', action: "delete"}]), async (req, res) => {
  try {
    const { id } = req.params;
    const deletedCommande = await Commande.findByIdAndDelete(id);
    if (!deletedCommande) {
      return res.status(404).json({ message: `Cannot find any Commande with ID ${id}` });
    }
    res.status(200).json(deletedCommande);
  } catch (error) {
    console.log(error.message);
    res.status(500).json({ message: error.message });
  }
});

router.post('/pay', authorizeJwt, verifyAccount([{name: 'commande', action: "create"}]),async (req, res) => {

  const user = req.user;
  let {amount, network, phoneNumber, orderId} = req.body
  let transactionResponse;
  const newTransactionId = new mongoose.Types.ObjectId();
  let transaction;

  try {

    if (!amount || !network || !phoneNumber || !orderId) return res.status(404).json({message: "Les données ne sont pas correctes"});

    const client = await Client.findOne({firstName: user.firstName , lastName: user.lastName, phone: user.phone, email: user.email}).exec();

    const order = await Commande.findOne({_id: orderId}).exec();

    if (!client) return res.status(404).json({message: "Le client n'existe pas"});

    if (!order) return res.status(404).json({message: "La commande n'existe pas"});



    if (!client._id.equals(order.client)) return res.status(404).json({message: "La commande n'existe pas pour ce client"});

    if (order.paymentStatus === "paid") return res.status(404).json({message: "La commande a déja été payé par mobile money"});


     transaction = await Transaction.findOne({item: order}).exec();


    amount = Number(amount);
    network = network.toUpperCase();

    if (transaction) {
      if (transaction.status === "success") return res.status(404).json({message: "La commande a déja une transaction réussie"});
    } else {
      transaction = await Transaction.create({
        _id: newTransactionId,
        name: `Achat de ${order.trackingId}`,
        amount: amount,
        status: "pending",
        step: "1",
        transactionType: "order",
        client: client,
        transactionPhone: {
          network: network,
          value: phoneNumber,
        },
        item: order
      });
    }

    const qosResponse = await qosService.makePayment(
        process.env.NODE_ENV === "development" ? "22967662166" : phoneNumber,
        process.env.NODE_ENV === "development" ? 1 : amount,
        network,
    );

    const processPayment = async () => {
      let qosTransactionResponse = await qosService.getTransactionStatus(
          qosResponse.data.transref,
          network,
      );

      transactionResponse = qosTransactionResponse.data;

      console.log(qosTransactionResponse.data.responsemsg);

      if (qosTransactionResponse.data.responsemsg !== "PENDING") {
        task.stop();
        switch (qosTransactionResponse.data.responsemsg) {
          case "SUCCESS":
          case "SUCCESSFUL":

            order.paymentStatus = "paid";
            transaction.status = "success";
            transaction.step = "2";

            await order.save();
            await transaction.save();

            return res.status(200).json({
              message: `Le paiement de la commande ${order.trackingId} a reussi`,
            });
          case "FAILED":
            transaction.status = "failed";
            await transaction.save();

            return res.status(400).json({
              message: "Le paiement a échoué",
            });
          default:

            transaction.status = "failed";
            await transaction.save();

            return res.status(400).json({
              message: "Le paiement a échoué",
            });
        }
      }
    };

    const task = cron.schedule("*/15 * * * * *", processPayment);

    setTimeout(async () => {
      if (transactionResponse.responsemsg === "PENDING") {
        task.stop();

        transaction.status = "failed";
        await transaction.save();

        return res.status(400).json({
          message: "Le paiement a pris trop de temps",
        });
      }
    }, 60000);



  } catch (error) {

      transaction.status = "failed";
      await transaction.save();

    console.error(error.message);
    res.status(500).json({ message: 'Server Error' });
  }
});


module.exports = router;
