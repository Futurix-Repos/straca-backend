const express = require('express');
const router = express.Router();
const MeasureUnit = require('../models/measureUnitModel');

const mongoose = require("mongoose");
const {authorizeJwt, verifyAccount} = require("../helpers/verifyAccount");

// GET /measureUnits - Get all measure units
router.get('/', authorizeJwt, verifyAccount([{name: 'measureUnit', action: "read"}]), async (req, res) => {

    const filter = {};
    const search = req.query.search;

    if (search) {
        filter.$or = [
            { description: { $regex: search, $options: "i" } },
            { label: { $regex: search, $options: "i" } },
        ];

    }

    try {
        const measureUnits = await MeasureUnit.find(filter);
        res.status(200).json(measureUnits);
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: error.message });
    }
});

// GET /measureUnits/:id - Get a specific measure unit by ID
router.get('/:id', authorizeJwt, verifyAccount([{name: 'measureUnit', action: "read"}]), async (req, res) => {
    try {
        const { id } = req.params;
        const measureUnit = await MeasureUnit.findById(id);

        if (!measureUnit) {
            return res.status(404).json({ message: `Measure unit with ID ${id} not found` });
        }

        res.status(200).json(measureUnit);
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: error.message });
    }
});

// POST /measureUnits - Create a new measure unit
router.post('/', authorizeJwt, verifyAccount([{name: 'measureUnit', action: "create"}]), async (req, res) => {
    try {
        // Generate a new ObjectId for the _id field
        const newId = new mongoose.Types.ObjectId();

        // Assign the generated _id to req.body
        req.body._id = newId;

        const measureUnit = await MeasureUnit.create(req.body);
        res.status(201).json(measureUnit);
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: error.message });
    }
});

// PUT /measureUnits/:id - Update a measure unit by ID
router.put('/:id', authorizeJwt, verifyAccount([{name: 'measureUnit', action: "update"}]), async (req, res) => {
    try {
        const { id } = req.params;
        const measureUnit = await MeasureUnit.findByIdAndUpdate(id, req.body, { new: true });

        if (!measureUnit) {
            return res.status(404).json({ message: `Cannot find any measure unit with ID ${id}` });
        }

        res.status(200).json(measureUnit);
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: error.message });
    }
});

// DELETE /measureUnits/:id - Delete a measure unit by ID
router.delete('/:id', authorizeJwt, verifyAccount([{name: 'measureUnit', action: "delete"}]), async (req, res) => {
    try {
        const { id } = req.params;
        const measureUnit = await MeasureUnit.findByIdAndDelete(id);

        if (!measureUnit) {
            return res.status(404).json({ message: `Cannot find any measure unit with ID ${id}` });
        }

        res.status(200).json(measureUnit);
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
