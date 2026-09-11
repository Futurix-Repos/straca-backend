const mongoose = require("mongoose");
const PermissionModel = require("../models/permissionModel");
const RoleModel = require("../models/roleModel");
const { ROLES } = require("../helpers/constants");

require("dotenv").config();

// Permission matrix per role
const ROLE_DEFINITIONS = [
  {
    code: ROLES.SUPER_ADMIN,
    name: "Super Administrateur",
    description: "Accès complet à toutes les ressources et fonctionnalités",
    isSystem: true,
    permissions: null, // null = all permissions
  },
  {
    code: ROLES.OPERATIONS,
    name: "Opérations",
    description: "Gestion des commandes, livraisons, véhicules et clients",
    isSystem: true,
    permissions: [
      { name: "commande", action: "create" },
      { name: "commande", action: "read" },
      { name: "commande", action: "update" },
      { name: "commande", action: "delete" },
      { name: "delivery", action: "create" },
      { name: "delivery", action: "read" },
      { name: "delivery", action: "update" },
      { name: "delivery", action: "delete" },
      { name: "deliveryTransfer", action: "create" },
      { name: "deliveryTransfer", action: "read" },
      { name: "deliveryTransfer", action: "update" },
      { name: "deliveryTransfer", action: "delete" },
      { name: "vehicleAssignment", action: "create" },
      { name: "vehicleAssignment", action: "read" },
      { name: "vehicleAssignment", action: "update" },
      { name: "vehicleAssignment", action: "delete" },
      { name: "client", action: "read" },
      { name: "client", action: "create" },
      { name: "client", action: "update" },
      { name: "employee", action: "read" },
      { name: "driver", action: "read" },
      { name: "vehicle", action: "read" },
      { name: "prestataire", action: "read" },
      { name: "prestataire", action: "create" },
      { name: "prestataire", action: "update" },
      { name: "product", action: "read" },
      { name: "pricing", action: "read" },
      { name: "report", action: "read" },
      { name: "catalog", action: "read" },
    ],
  },
  {
    code: ROLES.COMPTABILITE,
    name: "Comptabilité",
    description: "Lecture des opérations, gestion tarifaire et rapports",
    isSystem: true,
    permissions: [
      { name: "commande", action: "read" },
      { name: "delivery", action: "read" },
      { name: "deliveryTransfer", action: "read" },
      { name: "client", action: "read" },
      { name: "prestataire", action: "read" },
      { name: "product", action: "read" },
      { name: "pricing", action: "read" },
      { name: "pricing", action: "update" },
      { name: "report", action: "read" },
      { name: "report", action: "create" },
      { name: "catalog", action: "read" },
    ],
  },
  {
    code: ROLES.LECTEUR,
    name: "Lecteur",
    description: "Consultation en lecture seule des données opérationnelles",
    isSystem: true,
    permissions: [
      { name: "commande", action: "read" },
      { name: "delivery", action: "read" },
      { name: "deliveryTransfer", action: "read" },
      { name: "vehicleAssignment", action: "read" },
      { name: "client", action: "read" },
      { name: "employee", action: "read" },
      { name: "driver", action: "read" },
      { name: "vehicle", action: "read" },
      { name: "prestataire", action: "read" },
      { name: "product", action: "read" },
      { name: "pricing", action: "read" },
      { name: "report", action: "read" },
      { name: "blog", action: "read" },
      { name: "job", action: "read" },
      { name: "catalog", action: "read" },
    ],
  },
];

const ensurePermission = async (name, action) => {
  let perm = await PermissionModel.findOne({ name, action });
  if (!perm) {
    perm = await PermissionModel.create({
      _id: new mongoose.Types.ObjectId(),
      name,
      action,
      description: `Permission ${name} - ${action}`,
    });
    console.log(`  Created permission: ${name}.${action}`);
  }
  return perm;
};

const seedRoles = async () => {
  for (const def of ROLE_DEFINITIONS) {
    let permissionIds = [];

    if (def.permissions === null) {
      // super_admin: assign all permissions in DB
      const allPerms = await PermissionModel.find();
      permissionIds = allPerms.map((p) => p._id);
      console.log(`[${def.code}] Using all ${permissionIds.length} permissions`);
    } else {
      for (const p of def.permissions) {
        const perm = await ensurePermission(p.name, p.action);
        permissionIds.push(perm._id);
      }
    }

    const existing = await RoleModel.findOne({ code: def.code });
    if (existing) {
      existing.permissions = permissionIds;
      existing.name = def.name;
      existing.description = def.description;
      existing.isSystem = def.isSystem;
      await existing.save();
      console.log(`[${def.code}] Updated`);
    } else {
      await RoleModel.create({
        _id: new mongoose.Types.ObjectId(),
        code: def.code,
        name: def.name,
        description: def.description,
        permissions: permissionIds,
        active: true,
        isSystem: def.isSystem,
      });
      console.log(`[${def.code}] Created`);
    }
  }
};

const mongoUri = process.env.MONGODB_URI || `mongodb+srv://mikkyboy:mikkyboy@tutorial.sbvct.mongodb.net/straca?retryWrites=true&w=majority`;
mongoose.set("strictQuery", false);
mongoose
  .connect(mongoUri)
  .then(async () => {
    console.log("Connected to MongoDB");
    await seedRoles();
    console.log("Done.");
    mongoose.disconnect();
  })
  .catch((err) => console.log("Failed to connect to MongoDB", err));
