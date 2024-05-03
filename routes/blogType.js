const express = require('express');
const router = express.Router();
const BlogCategory = require('../models/blogTypeModel');

const mongoose = require("mongoose");
const {authorizeJwt, verifyAccount} = require("../helpers/verifyAccount");

// GET /blogCategory - Get all blogCategory
router.get('/', authorizeJwt, verifyAccount([{name: 'blogCategory', action: "read"}]), async (req, res) => {

    const filter = {};
    const search = req.query.search;

    if (search) {
        filter.$or = [
            {label: { $regex: search, $options: "i"}},
            { description: { $regex: search, $options: "i" } },
            
        ];

    }

    try {
        const blogCategory = await BlogCategory.find(filter);
        res.status(200).json(blogCategory);
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: error.message });
    }
});

// GET /blogCategory/:id - Get a specific blog by ID
router.get('/:id', authorizeJwt, verifyAccount([{name: 'blogCategory', action: "read"}]), async (req, res) => {
    try {
        const { id } = req.params;
        const blogCategory = await BlogCategory.findById(id);

        if (!blogCategory) {
            return res.status(404).json({ message: `BlogCategory with ID ${id} not found` });
        }

        res.status(200).json(blogCategory);
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: error.message });
    }
});

// POST /blogCategory - Create a new blogCategory
router.post('/', authorizeJwt, verifyAccount([{name: 'blogCategory', action: "create"}]), async (req, res) => {
    try {
        // Generate a new ObjectId for the _id field
        const newId = new mongoose.Types.ObjectId();

        // Assign the generated _id to req.body
        req.body._id = newId;

        const blogCategory = await BlogCategory.create(req.body);
        res.status(201).json(blogCategory);
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: error.message });
    }
});

// PUT /blogCategory/:id - Update a blogCategory by ID
router.put('/:id', authorizeJwt, verifyAccount([{name: 'blogCategory', action: "update"}]), async (req, res) => {
    try {
        const { id } = req.params;
        const blogCategory = await BlogCategory.findByIdAndUpdate(id, req.body, { new: true });

        if (!blogCategory) {
            return res.status(404).json({ message: `Cannot find any blogCategory with ID ${id}` });
        }

        res.status(200).json(blogCategory);
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: error.message });
    }
});

// DELETE /blogCategory/:id - Delete a blogCategory by ID
router.delete('/:id', authorizeJwt, verifyAccount([{name: 'blogCategory', action: "delete"}]), async (req, res) => {
    try {
        const { id } = req.params;
        const blogCategory = await BlogCategory.findByIdAndDelete(id);

        if (!blogCategory) {
            return res.status(404).json({ message: `Cannot find any blogCategory with ID ${id}` });
        }

        res.status(200).json(blogCategory);
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
