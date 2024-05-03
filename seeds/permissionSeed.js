const mongoose = require("mongoose");
const PermissionModel = require("../models/permissionModel");
const {validPermissionNames} = require("../helpers/constants");



require("dotenv").config();

const seedPermissionTable = async (name, description = "", action) => {
  try {



    const oldPermission = await PermissionModel.findOne({
      name, action
    }).exec();

    if (oldPermission) {
      console.log(
        `permission ${name} with action ${action} found`,
      );
    } else {
      const newPermission = await PermissionModel.create({
        _id: new mongoose.Types.ObjectId(),
        name,
        description,
        action,
      });
      if (newPermission)
        console.log(
          `permission ${name} with action ${action} create successfully`,
        );
      else console.log("cannot create new permission");
    }
  } catch (e) {
    console.log(e.message);
  }
};

const mongoUri = `mongodb+srv://mikkyboy:mikkyboy@tutorial.sbvct.mongodb.net/straca?retryWrites=true&w=majority`;
mongoose.set("strictQuery", false);
mongoose
  .connect(mongoUri)
  .then(async () => {
    console.log("Connected to MongoDB");


    for (let validPermissionName of validPermissionNames) {

      await seedPermissionTable(validPermissionName, `Permission for ${validPermissionName} actions`, "update");
      await seedPermissionTable(validPermissionName, `Permission for ${validPermissionName} actions`, "read");
      await seedPermissionTable(validPermissionName, `Permission for ${validPermissionName} actions`, "create");
      await seedPermissionTable(validPermissionName, `Permission for ${validPermissionName} actions`, "delete");

      await PermissionModel.deleteMany({action: "list"});

    }

    mongoose.disconnect();
  })
  .catch((err) => console.log("Failed to connect to MongoDB", err));
