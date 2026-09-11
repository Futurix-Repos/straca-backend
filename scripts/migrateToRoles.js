/**
 * Migration: assign roles to existing users
 * - admin → super_admin
 * - employee → lecteur
 * Run AFTER roleSeed.js
 */

const mongoose = require("mongoose");
const UserModel = require("../models/userModel");
const RoleModel = require("../models/roleModel");
const { ROLES } = require("../helpers/constants");

require("dotenv").config();

const migrate = async () => {
  const [superAdminRole, lecteurRole] = await Promise.all([
    RoleModel.findOne({ code: ROLES.SUPER_ADMIN }),
    RoleModel.findOne({ code: ROLES.LECTEUR }),
  ]);

  if (!superAdminRole || !lecteurRole) {
    console.error("Roles not found. Run roleSeed.js first.");
    process.exit(1);
  }

  const adminResult = await UserModel.updateMany(
    { type: "admin", role: { $exists: false } },
    { $set: { role: superAdminRole._id } }
  );
  console.log(`Admins migrated to super_admin: ${adminResult.modifiedCount}`);

  const employeeResult = await UserModel.updateMany(
    { type: "employee", role: { $exists: false } },
    { $set: { role: lecteurRole._id } }
  );
  console.log(`Employees migrated to lecteur: ${employeeResult.modifiedCount}`);

  // Report users without role (clients are expected to have none)
  const withoutRole = await UserModel.countDocuments({
    type: { $ne: "client" },
    role: { $exists: false },
  });
  if (withoutRole > 0) {
    console.warn(`Warning: ${withoutRole} non-client users still without a role`);
  }

  console.log("Migration complete.");
};

const mongoUri = process.env.MONGODB_URI || `mongodb+srv://mikkyboy:mikkyboy@tutorial.sbvct.mongodb.net/straca?retryWrites=true&w=majority`;
mongoose.set("strictQuery", false);
mongoose
  .connect(mongoUri)
  .then(async () => {
    console.log("Connected to MongoDB");
    await migrate();
    mongoose.disconnect();
  })
  .catch((err) => console.log("Failed to connect to MongoDB", err));
