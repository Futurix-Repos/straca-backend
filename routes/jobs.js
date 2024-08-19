const express = require("express");
const router = express.Router();
const Job = require("../models/jobModel");
const Proximity = require("../models/proximityModel");
const ContractType = require("../models/contractTypeModel");

const mongoose = require("mongoose");
const {
  authorizeJwt,
  verifyAccount,
  authorizePublic,
} = require("../helpers/verifyAccount");

// GET Job Filters
router.get(
  "/filters/public",
  authorizePublic(process.env.PUBLIC_TOKEN),
  async (req, res) => {
    try {
      const proximity = await Proximity.find().select("label");

      const contractTypes = await ContractType.find().select("label");

      const jobTitles = await Job.find().select("post");

      const newProximity = await proximity.map((item) => {
        return { id: item._id, label: item.label, value: item.label };
      });

      const newContractTypes = contractTypes.map((item) => {
        return { id: item._id, label: item.label, value: item.label };
      });

      const newJobTitles = jobTitles
        .filter((value, index) => {
          return index === jobTitles.findIndex((o) => value.post === o.post);
        })
        .map((item) => {
          return { id: item._id, label: item.post, value: item.post };
        });

      res.status(200).json({
        proximity: newProximity,
        contractTypes: newContractTypes,
        jobTitles: newJobTitles,
      });
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: error.message });
    }
  },
);

// GET /jobs/public - Get all jobs for public
router.get(
  "/public",
  authorizePublic(process.env.PUBLIC_TOKEN),
  async (req, res) => {
    const match = {};
    const search = req.query.search;
    const proximity = req.query.proximity;
    const contractTypes = req.query.contractTypes;
    const jobTitles = req.query.jobTitles;
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;

    const page = parseInt(req.query.page ?? "1");
    const limit = parseInt(req.query.limit ?? "10");

    let aggregationPipeline = [];

    aggregationPipeline = aggregationPipeline.concat([
      {
        $lookup: {
          from: Proximity.collection.name,
          localField: "proximity",
          foreignField: "_id",
          as: "proximity",
        },
      },
      { $unwind: "$proximity" },
      {
        $lookup: {
          from: ContractType.collection.name,
          localField: "contractType",
          foreignField: "_id",
          as: "contractType",
        },
      },
      { $unwind: "$contractType" },
    ]);

    if (startDate && endDate) {
      match.updatedAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    } else if (startDate) {
      match.updatedAt = { $gte: new Date(startDate) };
    } else if (endDate) {
      match.updatedAt = { $lte: new Date(endDate) };
    }

    if (proximity) {
      if (Array.isArray(proximity)) {
        match["proximity.label"] = { $in: proximity };
      }
    }

    if (contractTypes) {
      if (Array.isArray(contractTypes)) {
        match["contractType.label"] = { $in: contractTypes };
      }
    }

    if (jobTitles) {
      if (Array.isArray(jobTitles)) {
        match["post"] = { $in: jobTitles };
      }
    }

    if (search) {
      match.$or = [
        { post: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { "proximity.label": { $regex: search, $options: "i" } },
        { "contractType.label": { $regex: search, $options: "i" } },
      ];
    }

    if (Object.keys(match).length > 0) {
      aggregationPipeline.push({ $match: match });
    }

    aggregationPipeline = aggregationPipeline.concat([
      { $sort: { updatedAt: -1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
      {
        $project: {
          post: 1,
          description: 1,
          salary: 1,
          createdAt: 1,
          updatedAt: 1,
          proximity: {
            label: "$proximity.label",
          },
          contractType: {
            label: "$contractType.label",
          },
        },
      },
    ]);

    const countPipeline = [
      {
        $lookup: {
          from: Proximity.collection.name,
          localField: "proximity",
          foreignField: "_id",
          as: "proximity",
        },
      },
      { $unwind: "$proximity" },
      {
        $lookup: {
          from: ContractType.collection.name,
          localField: "contractType",
          foreignField: "_id",
          as: "contractType",
        },
      },
      { $unwind: "$contractType" },
      { $match: match },
      { $count: "total" },
    ];

    try {
      const count = await Job.aggregate(countPipeline);
      const jobs = await Job.aggregate(aggregationPipeline);

      const totalCount = count[0]?.total || 0;

      res.status(200).json({
        jobs,
        limit,
        page,
        totalPages: Math.ceil(totalCount / limit),
        total: totalCount,
      });
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: error.message });
    }
  },
);

// GET /jobs - Get all jobs
router.get(
  "/",
  authorizeJwt,
  verifyAccount([{ name: "jobs", action: "read" }]),
  async (req, res) => {
    const filter = {};
    const search = req.query.search;

    if (search) {
      filter.$or = [
        { post: { $regex: search, $options: "i" } },
        { salary: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { location: { $regex: search, $options: "i" } },
      ];
    }

    try {
      const job = await Job.find(filter).populate("proximity contractType");
      res.status(200).json(job);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: error.message });
    }
  },
);

//get all jobs: Client///
router.get("/clients", async (req, res) => {
  const filter = {};
  const search = req.query.search;
  const location = req.query.location;
  const salary = req.query.salary;

  if (location) {
    filter.location = { proximity: { $elemMatch: { label: location } } };
  }
  if (salary) {
    filter.salary = { $gte: parseFloat(salary) };
  }

  if (search) {
    filter.$or = [
      { post: { $regex: search, $options: "i" } },
      // { salary: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
      { location: { $regex: search, $options: "i" } },
    ];
  }

  try {
    const job = await Job.find(filter).populate("proximity contractType");
    res.status(200).json(job);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: error.message });
  }
});
// GET /jobs/:id - Get a specific job by ID
router.get(
  "/:id",
  authorizeJwt,
  verifyAccount([{ name: "job", action: "read" }]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const job = await job.findById(id).populate("proximity contractType");

      if (!job) {
        return res.status(404).json({ message: `Job with ID ${id} not found` });
      }

      res.status(200).json(job);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: error.message });
    }
  },
);

// POST /job - Create a new job
router.post(
  "/",
  authorizeJwt,
  verifyAccount([{ name: "job", action: "create" }]),
  async (req, res) => {
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
  },
);

// PUT /job /:id - Update a job by ID
router.put(
  "/:id",
  authorizeJwt,
  verifyAccount([{ name: "job", action: "update" }]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const job = await Job.findByIdAndUpdate(id, req.body, { new: true });

      if (!job) {
        return res
          .status(404)
          .json({ message: `Cannot find any job with ID ${id}` });
      }

      res.status(200).json(job);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: error.message });
    }
  },
);

// DELETE /job/:id - Delete a job by ID
router.delete(
  "/:id",
  authorizeJwt,
  verifyAccount([{ name: "job", action: "delete" }]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const job = await Job.findByIdAndDelete(id);

      if (!job) {
        return res
          .status(404)
          .json({ message: `Cannot find any job with ID ${id}` });
      }

      res.status(200).json(job);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: error.message });
    }
  },
);

module.exports = router;
