const express = require('express');
const router = express.Router();
const Job = require('../models/jobmodel');

const mongoose = require("mongoose");
const { authorizeJwt, verifyAccount } = require("../helpers/verifyAccount");

// GET /jobs - Get all jobs
router.get('/', authorizeJwt, verifyAccount([{ name: 'jobs', action: "read" }]), async (req, res) => {

    const filter = {};
    const search = req.query.search;



    if (search) {
        filter.$or = [
            { post: { $regex: search, $options: "i" } },
            { salary: { $regex: search, $options: "i" } },
            { description: { $regex: search, $options: "i" } },
            { location: { $regex: search, $options: "i" } }

        ];

    }


    try {
        const job = await Job.find(filter).populate('proximity contractType');
        res.status(200).json(job);
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: error.message });
    }
});

//get all jobs: Client///
router.get('/clients', async (req, res) => {
    const filter = {};
    const search = req.query.search;
    const location = req.query.location;
    const salary= req.query.salary;

    if (location) {
        filter.location = {proximity: {$elemMatch: {label: location}}}
        
    }
    if(salary) {
        filter.salary = { $gte: parseFloat(salary) };
    }



    if (search) {
        filter.$or = [
            { post: { $regex: search, $options: "i" } },
            // { salary: { $regex: search, $options: "i" } },
            { description: { $regex: search, $options: "i" } },
            { location: { $regex: search, $options: "i" } }

        ];
    }


    try {
        const job = await Job.find(filter).populate('proximity contractType');
        res.status(200).json(job);
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: error.message });
    }
});
// GET /jobs/:id - Get a specific job by ID
router.get('/:id', authorizeJwt, verifyAccount([{ name: 'job', action: "read" }]), async (req, res) => {
    try {
        const { id } = req.params;
        const job = await job.findById(id).populate('proximity contractType');

        if (!job) {
            return res.status(404).json({ message: `Job with ID ${id} not found` });
        }

        res.status(200).json(job);
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: error.message });
    }
});

// POST /job - Create a new job
router.post('/', authorizeJwt, verifyAccount([{ name: 'job', action: "create" }]), async (req, res) => {
    try {
        // Generate a new ObjectId for the _id field
        const newId = new mongoose.Types.ObjectId();

        // Assign the generated _id to req.body
        req.body._id = newId;

        const job = await Job.create(req.body);
        res.status(201).json(job);
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: error.message });
    }
});

// PUT /job /:id - Update a job by ID
router.put('/:id', authorizeJwt, verifyAccount([{ name: 'job', action: "update" }]), async (req, res) => {
    try {
        const { id } = req.params;
        const job = await Job.findByIdAndUpdate(id, req.body, { new: true });

        if (!job) {
            return res.status(404).json({ message: `Cannot find any job with ID ${id}` });
        }

        res.status(200).json(job);
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: error.message });
    }
});

// DELETE /job/:id - Delete a job by ID
router.delete('/:id', authorizeJwt, verifyAccount([{ name: 'job', action: "delete" }]), async (req, res) => {
    try {
        const { id } = req.params;
        const job = await Job.findByIdAndDelete(id);

        if (!job) {
            return res.status(404).json({ message: `Cannot find any job with ID ${id}` });
        }

        res.status(200).json(job);
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
