const express = require('express');
const router = express.Router();

const mongoose = require("mongoose");
const Commande = require('../models/commandeModel');
const Client = require('../models/clientModel');

router.get('/', async (req, res) => {
    const commandes = await Commande.find();
    const clients = await Client.find();
    const deliveredCommandes = await Commande.find({ status: 'Commande Arrivée' });

    const myData = {
        totalColis: commandes.length,
        totalClients: clients.length,
        totalColisDelivered: deliveredCommandes.length,
    }
    res.status(200).json(myData);
});

module.exports = router;
