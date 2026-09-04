const express = require("express");
const router = express.Router();
const Vehicle = require("../models/vehicleModel");
const Prestataire = require("../models/prestataireModel");
const Driver = require("../models/driverModel");
const VehicleDriverAssignment = require("../models/vehicleDriverAssignmentModel");

const mongoose = require("mongoose");
const { authorizeJwt, verifyAccount } = require("../helpers/verifyAccount");
const Delivery = require("../models/deliveryModel");
const wialonServices = require("../helpers/iotHelper");
const { computeFuelValue, getSensorByP } = require("../helpers/iotModule");
const vehicleTrackingService = require("../services/vehicleTracking");
const {
  isDuplicateKeyError,
  paginationFromQuery,
  prepareVehiclePayload,
} = require("../services/vehicleReference");
const { normalizeDriverKey, normalizePlate } = require("../helpers/referenceNormalization");

const populateArray = [
  {
    path: "model",
    select: "label",
    populate: {
      path: "brand",
      select: "label",
    },
  },
  {
    path: "type",
    select: "label",
  },
  {
    path: "source",
    select: "label isExternal",
  },
  {
    path: "prestataire",
    select: "name type zone isActive",
  },
  {
    path: "driver",
    select: "firstName lastName email phone",
  },
  {
    path: "createdBy",
    select: "firstName lastName email phone",
  },
];

// GET /vehicle - Get all vehicles
router.get(
  "/modules",
  authorizeJwt,
  verifyAccount([{ name: "vehicle", action: "read" }]),
  async (req, res) => {
    const search = req.query.search ?? "";

    try {
      let spec = {
        itemsType: "avl_unit",
        propName: "sys_name",
        propValueMask: "*",
        sortType: "sys_name",
      };

      if (search.length > 0) spec.propValueMask = `*${search.toString()}*`;

      const response = await wialonServices.searchItems({ spec });

      if (response.error)
        return res.status(400).json({ message: "Une erreur est survenue." });

      let modules = response.items.map((item) => {
        return {
          plate: item.nm,
          id: item.id,
        };
      });

      res.status(200).json({ modules });
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: error.message });
    }
  },
);

// GET /vehicle - Get all vehicles
router.get(
  "/",
  authorizeJwt,
  verifyAccount([{ name: "vehicle", action: "read" }]),
  async (req, res) => {
    const filter = {};
    const search = req.query.q || req.query.search;
    const { prestataireId, status } = req.query;

    if (search) {
      const normalizedSearch = normalizePlate(search);
      filter.$or = [
        { plateNormalized: { $regex: normalizedSearch, $options: "i" } },
        { plateRaw: { $regex: search, $options: "i" } },
        { registrationNumber: { $regex: search, $options: "i" } },
      ];
    }
    if (prestataireId) filter.prestataire = prestataireId;
    if (status) filter.status = status;

    try {
      const query = Vehicle.find(filter).sort({ plateNormalized: 1 }).populate(populateArray);
      if (req.query.page || req.query.perPage) {
        const { limit, page, skip } = paginationFromQuery(req.query);
        const [items, total] = await Promise.all([
          query.skip(skip).limit(limit),
          Vehicle.countDocuments(filter),
        ]);
        return res.status(200).json({ items, page, perPage: limit, total });
      }
      const vehicle = await query;

      res.status(200).json(vehicle);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: error.message });
    }
  },
);

// POST /vehicle - Create a new vehicle
router.post(
  "/",
  authorizeJwt,
  verifyAccount([{ name: "vehicle", action: "create" }]),
  async (req, res) => {
    try {
      const payload = prepareVehiclePayload(req.body);
      if (payload.prestataire) {
        const prestataire = await Prestataire.findById(payload.prestataire);
        if (!prestataire) {
          return res.status(404).json({ message: "Prestataire introuvable" });
        }
      }

      const driverPayload = payload.driverDetails || payload.driverProfile;
      delete payload.driverDetails;
      delete payload.driverProfile;
      payload._id = new mongoose.Types.ObjectId();
      const vehicle = await Vehicle.create(payload);

      if (driverPayload?.fullName) {
        const nameKey = normalizeDriverKey(driverPayload.fullName);
        const driver = await Driver.findOneAndUpdate(
          { nameKey },
          { $setOnInsert: { fullName: driverPayload.fullName, nameKey } },
          { upsert: true, new: true, runValidators: true },
        );
        await VehicleDriverAssignment.create({
          vehicle: vehicle._id,
          driver: driver._id,
          linkType: "current",
          assignedBy: req.user?._id || null,
        });
      }
      res.status(201).json(vehicle);
    } catch (error) {
      console.error(error.message);
      if (isDuplicateKeyError(error)) {
        return res.status(409).json({ message: "Cette plaque existe déjà." });
      }
      res.status(500).json({ message: error.message });
    }
  },
);

// GET /vehicle/plate/:plate - Get a specific vehicle by ID
router.get(
  "/check-availability/:plate",
  authorizeJwt,
  verifyAccount([{ name: "vehicle", action: "read" }]),

  async (req, res) => {
    try {
      const { plate } = req.params;

      // First find the vehicle by registration number
      const vehicle = await Vehicle.findOne({
        plateNormalized: normalizePlate(plate),
      }).populate(populateArray);

      if (!vehicle) {
        return res.status(404).json({
          success: false,
          message: "Vehicle not found",
        });
      }

      // If no pending deliveries found, vehicle is available
      res.status(200).json({
        success: true,
        message: "Vehicle is available",
        vehicle: vehicle,
      });
    } catch (error) {
      console.error("Error in checkVehicleAvailability:", error);
      res.status(500).json({
        success: false,
        message: "Error checking vehicle availability",
        error: error.message,
      });
    }
  },
);

router.patch(
  "/:id/driver",
  authorizeJwt,
  verifyAccount([{ name: "vehicle", action: "update" }]),
  async (req, res) => {
    try {
      const { fullName, linkType = "current", startsAt } = req.body;
      if (!fullName) return res.status(400).json({ message: "Le nom du chauffeur est obligatoire." });
      if (!["current", "future"].includes(linkType)) {
        return res.status(422).json({ message: "Le type de liaison est invalide." });
      }
      const vehicle = await Vehicle.findById(req.params.id);
      if (!vehicle) return res.status(404).json({ message: "Véhicule introuvable" });

      const nameKey = normalizeDriverKey(fullName);
      const driver = await Driver.findOneAndUpdate(
        { nameKey },
        { $setOnInsert: { fullName: fullName.trim(), nameKey } },
        { upsert: true, new: true, runValidators: true },
      );
      await VehicleDriverAssignment.updateMany(
        { vehicle: vehicle._id, linkType, endsAt: null },
        { $set: { endsAt: new Date() } },
      );
      const assignment = await VehicleDriverAssignment.create({
        vehicle: vehicle._id,
        driver: driver._id,
        linkType,
        startsAt: startsAt || new Date(),
        assignedBy: req.user?._id || null,
      });
      return res.status(200).json({ assignment, driver });
    } catch (error) {
      console.error(error.message);
      if (isDuplicateKeyError(error)) return res.status(409).json({ message: "Une affectation active existe déjà." });
      return res.status(500).json({ message: error.message });
    }
  },
);

// GET /vehicles/:id/module - Get a specific vehicle module by ID
router.get(
  "/:id/module",
  authorizeJwt,
  verifyAccount([{ name: "vehicle", action: "read" }]),

  async (req, res) => {
    try {
      const { id } = req.params;
      const vehicle = await Vehicle.findById(id);

      if (!vehicle) {
        return res
          .status(404)
          .json({ message: `Vehicle with ID ${id} not found` });
      }

      if (!vehicle?.tracking?.id) {
        return res
          .status(400)
          .json({ message: `This vehicle has not tracking` });
      }

      let response = {
        id: vehicle.id,
        tracking: vehicle.tracking,
      };

      const dataPos = await wialonServices.searchItemById({
        itemId: vehicle.tracking.id,
        flags: 4294967295,
      });

      if (dataPos.error)
        return res.status(400).json({ message: "Une erreur est survenue." });

      //console.log(`https://hst-api.wialon.eu${dataPos.item.uri}`);

      response["pin_img"] = dataPos?.item?.uri
        ? `https://hst-api.wialon.eu${dataPos.item.uri}`
        : null;

      response["pos"] = {
        lat: dataPos?.item?.pos?.y,
        lng: dataPos?.item?.pos?.x,
        speed: dataPos?.item?.pos?.s,
      };

      const tempRaw = dataPos?.item?.prms?.io_26?.v;
      const tempSensor = getSensorByP(dataPos?.item?.sens, "io_26*const10");

      response.temp = {
        value: tempRaw !== undefined ? tempRaw * 10 : null,
        unit: tempSensor?.m || null,
      };

      response["active"] =
        dataPos?.item?.prms?.io_239?.v !== null
          ? dataPos.item.prms.io_239.v === 1
          : null;

      const fuelRaw = dataPos?.item?.prms?.io_273?.v;
      const fuelSensor = getSensorByP(dataPos?.item?.sens, "io_273");

      if (
        fuelRaw !== undefined &&
        fuelSensor?.tbl &&
        Array.isArray(fuelSensor.tbl)
      ) {
        response.fuel = {
          value: computeFuelValue(fuelRaw, fuelSensor.tbl),
          unit: fuelSensor.m || null,
        };
      }

      res.status(200).json(response);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: error.message });
    }
  },
);

// GET /vehicle/:id - Get a specific vehicle by ID
router.get(
  "/:id",
  authorizeJwt,
  verifyAccount([{ name: "vehicle", action: "read" }]),

  async (req, res) => {
    try {
      const { id } = req.params;
      const vehicle = await Vehicle.findById(id).populate([
        ...populateArray,
        {
          path: "deliveries",
          populate: [
            {
              path: "sender.user",
              select: "firstName lastName email telephone",
            },
            {
              path: "receiver.user",
              select: "firstName lastName email telephone",
            },
          ],
        },
      ]);

      if (!vehicle) {
        return res
          .status(404)
          .json({ message: `Vehicle with ID ${id} not found` });
      }

      res.status(200).json(vehicle);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: error.message });
    }
  },
);

// PUT /vehicle/:id - Update a vehicle by ID
router.put(
  "/:id",
  authorizeJwt,
  verifyAccount([{ name: "vehicle", action: "update" }]),
  async (req, res) => {
    try {
      const { id } = req.params;

      const vehicle = await Vehicle.findById(id);
      if (!vehicle) {
        return res
          .status(404)
          .json({ message: `Cannot find any vehicle with ID ${id}` });
      }

      const payload = prepareVehiclePayload(req.body);
      if (payload.prestataire) {
        const prestataire = await Prestataire.findById(payload.prestataire);
        if (!prestataire) return res.status(404).json({ message: "Prestataire introuvable" });
      }
      vehicle.set(payload);
      await vehicle.save();

      res.status(200).json(vehicle);
    } catch (error) {
      console.error(error.message);
      if (isDuplicateKeyError(error)) return res.status(409).json({ message: "Cette plaque existe déjà." });
      res.status(500).json({ message: error.message });
    }
  },
);
// DELETE /vehicle/:id - Delete a vehicle by ID
router.delete(
  "/:id",
  authorizeJwt,
  verifyAccount([{ name: "vehicle", action: "delete" }]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const vehicle = await Vehicle.findByIdAndUpdate(
        id,
        { status: "inactive" },
        { new: true, runValidators: true },
      );

      if (!vehicle) {
        return res
          .status(404)
          .json({ message: `Cannot find any vehicle with ID ${id}` });
      }

      res.status(200).json(vehicle);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: error.message });
    }
  },
);

module.exports = router;
