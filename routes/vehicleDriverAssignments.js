const express = require("express");
const VehicleDriverAssignment = require("../models/vehicleDriverAssignmentModel");
const { authorizeJwt, verifyAccount } = require("../helpers/verifyAccount");
const { paginationFromQuery } = require("../services/vehicleReference");

const router = express.Router();

router.get("/", authorizeJwt, verifyAccount([{ name: "vehicle", action: "read" }]), async (req, res) => {
  try {
    const filter = {};
    if (req.query.vehicleId) filter.vehicle = req.query.vehicleId;
    if (req.query.driverId) filter.driver = req.query.driverId;
    if (req.query.linkType) filter.linkType = req.query.linkType;
    if (req.query.active === "true") filter.endsAt = null;

    const { limit, page, skip } = paginationFromQuery(req.query);
    const [items, total] = await Promise.all([
      VehicleDriverAssignment.find(filter)
        .populate("vehicle", "registrationNumber plateRaw plateNormalized")
        .populate("driver", "fullName nameKey")
        .sort({ startsAt: -1 })
        .skip(skip)
        .limit(limit),
      VehicleDriverAssignment.countDocuments(filter),
    ]);
    res.status(200).json({ items, page, perPage: limit, total });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
