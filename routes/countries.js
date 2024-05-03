const express = require('express');
const router = express.Router();
const Country = require('../models/countryTypeModel');

const mongoose = require("mongoose");
const {authorizeJwt, verifyAccount} = require("../helpers/verifyAccount");

// GET /countries - Get all countries
router.get('/', authorizeJwt, verifyAccount([{name: 'CountryType', action: "read"}]), async (req, res) => {

    const filter = {};
    const search = req.query.search;

    if (search) {
        filter.$or = [
            { description: { $regex: search, $options: "i" } },
            { label: { $regex: search, $options: "i" } },
        ];

    }

    try {
        const countries = await Country.find(filter);
        res.status(200).json(countries);
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: error.message });
    }
});

// GET /countries/:id - Get a specific country by ID
router.get('/:id', authorizeJwt, verifyAccount([{name: 'CountryType', action: "read"}]), async (req, res) => {
    try {
        const { id } = req.params;
        const country = await Country.findById(id);

        console.log(country);

        if (!country) {
            return res.status(404).json({ message: `Country with ID ${id} not found` });
        }

        res.status(200).json(country);
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: error.message });
    }
});

// POST /countries - Create a new country
router.post('/', authorizeJwt, verifyAccount([{name: 'CountryType', action: "create"}]), async (req, res) => {
    try {
        // Generate a new ObjectId for the _id field
        const newId = new mongoose.Types.ObjectId();

        // Assign the generated _id to req.body
        req.body._id = newId;

        const country = await Country.create(req.body);
        res.status(201).json(country);
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: error.message });
    }
});

// PUT /countries/:id - Update a country by ID
router.put('/:id', authorizeJwt, verifyAccount([{name: 'CountryType', action: "update"}]), async (req, res) => {
    try {
        const { id } = req.params;
        const country = await Country.findByIdAndUpdate(id, req.body, { new: true });

        if (!country) {
            return res.status(404).json({ message: `Cannot find any country with ID ${id}` });
        }

        res.status(200).json(country);
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: error.message });
    }
});

// DELETE /countries/:id - Delete a country by ID
router.delete('/:id', authorizeJwt, verifyAccount([{name: 'CountryType', action: "delete"}]), async (req, res) => {
    try {
        const { id } = req.params;
        const country = await Country.findByIdAndDelete(id);

        if (!country) {
            return res.status(404).json({ message: `Cannot find any country with ID ${id}` });
        }

        res.status(200).json(country);
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
