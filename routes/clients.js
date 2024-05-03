const express = require('express');
const router = express.Router();
const Client = require('../models/clientModel');
const {authorizeJwt, verifyAccount} = require("../helpers/verifyAccount");

router.get('/', authorizeJwt, verifyAccount([{name: 'client', action: "read"}]), async (req, res) => {

  const filter = {};
  const search = req.query.search;

  if (search) {
    filter.$or = [
      { firstName: { $regex: search, $options: "i" } },
      { lastName: { $regex: search, $options: "i" } },
      { phone: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      // { address: { $regex: search, $options: "i" } },
    ];
  }

  try {
    const clients = await Client.find(filter);
    res.status(200).json(clients);
  } catch (error) {
    console.log(error.message);
    res.status(500).json({ message: error.message });
  }
});

router.get('/:id', authorizeJwt, verifyAccount([{name: 'client', action: "read"}]),async (req, res) => {
  try {
    const { id } = req.params;
    const client = await Client.findById(id);

    if (!client) {
      return res.status(404).json({ message: `Client with ID ${id} not found` });
    }

    res.status(200).json(client);
  } catch (error) {
    console.log(error.message);
    res.status(500).json({ message: error.message });
  }
});

router.post('/', authorizeJwt, verifyAccount([{name: 'client', action: "create"}]),async (req, res) => {
  try {
    const client = await Client.create(req.body);
    res.status(201).json(client);
  } catch (error) {
    console.log(error.message);
    res.status(500).json({ message: error.message });
  }
});

router.put('/:id', authorizeJwt, verifyAccount([{name: 'client', action: "update"}]),async (req, res) => {
  try {
    const { id } = req.params;
    const client = await Client.findByIdAndUpdate(id, req.body, { new: true });
    if (!client) {
      return res.status(404).json({ message: `Cannot find any client with ID ${id}` });
    }
    res.status(200).json(client);
  } catch (error) {
    console.log(error.message);
    res.status(500).json({ message: error.message });
  }
});

router.delete('/:id', authorizeJwt, verifyAccount([{name: 'client', action: "delete"}]), async (req, res) => {
  try {
    const { id } = req.params;
    const client = await Client.findByIdAndDelete(id);
    if (!client) {
      return res.status(404).json({ message: `Cannot find any client with ID ${id}`});
    }
    res.status(200).json(client);
  } catch (error) {
    console.log(error.message);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;