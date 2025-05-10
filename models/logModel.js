const mongoose = require("mongoose");

const logSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      enum: [
        "CREATE",
        "UPDATE",
        "DELETE",
        "LOGIN",
        "LOGOUT",
        "ERROR",
        "INFO",
        "SYSTEM",
        "OTHER",
      ],
    },
    entities: [
      {
        entityType: {
          type: String,
          required: true,
        },
        entityId: {
          type: mongoose.Schema.Types.ObjectId,
          required: true,
        },
      },
    ],
    description: {
      type: String,
      required: true,
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    previousState: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    newState: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    users: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    level: {
      type: String,
      enum: ["INFO", "WARNING", "ERROR", "CRITICAL"],
      default: "INFO",
    },
  },
  {
    timestamps: true,
  },
);

// Create indexes for common query patterns
logSchema.index({ action: 1 });
logSchema.index({ "entities.entityType": 1, "entities.entityId": 1 });
logSchema.index({ users: 1 });
logSchema.index({ level: 1 });
logSchema.index({ createdAt: 1 });

// Helper method to format users
const formatUsers = (users) => {
  if (!users) return [];
  const userArray = Array.isArray(users) ? users : [users];
  return userArray.map((user) => user?._id || user).filter(Boolean);
};

// Helper method to format entities
const formatEntities = (entities) => {
  if (!entities) return [];

  // If entities is not an array, convert it to array with a single item
  const entitiesArray = Array.isArray(entities) ? entities : [entities];

  return entitiesArray.map((entity) => {
    if (entity.entityType && entity.entityId) {
      return entity;
    }

    if (typeof entity === "string") {
      return { entityType: "Unknown", entityId: entity };
    }

    return {
      entityType: entity.type || entity.constructor?.modelName || "Unknown",
      entityId: entity._id || entity,
    };
  });
};

// Refactored static methods using object parameters
logSchema.statics.createLog = async function (params) {
  return await this.create(params);
};

logSchema.statics.logCreate = async function ({
  users,
  entities,
  entityType,
  entityId,
  newState,
  details = {},
  description,
  level = "INFO",
}) {
  // Handle both new (entities) and old (entityType + entityId) parameter styles
  const formattedEntities = entities
    ? formatEntities(entities)
    : formatEntities({ entityType, entityId });

  // Generate description if not provided
  const logDescription =
    description ||
    `${formattedEntities.map((e) => e.entityType).join(", ")} created`;

  return await this.create({
    action: "CREATE",
    entities: formattedEntities,
    description: logDescription,
    newState,
    users: formatUsers(users),
    details,
    level,
  });
};

logSchema.statics.logUpdate = async function ({
  users,
  entities,
  entityType,
  entityId,
  previousState,
  newState,
  details = {},
  description,
  level = "INFO",
}) {
  // Handle both new (entities) and old (entityType + entityId) parameter styles
  const formattedEntities = entities
    ? formatEntities(entities)
    : formatEntities({ entityType, entityId });

  // Generate description if not provided
  const logDescription =
    description ||
    `${formattedEntities.map((e) => e.entityType).join(", ")} updated`;

  return await this.create({
    action: "UPDATE",
    entities: formattedEntities,
    description: logDescription,
    previousState,
    newState,
    users: formatUsers(users),
    details,
    level,
  });
};

logSchema.statics.logDelete = async function ({
  users,
  entities,
  entityType,
  entityId,
  previousState,
  details = {},
  description,
  level = "INFO",
}) {
  // Handle both new (entities) and old (entityType + entityId) parameter styles
  const formattedEntities = entities
    ? formatEntities(entities)
    : formatEntities({ entityType, entityId });

  // Generate description if not provided
  const logDescription =
    description ||
    `${formattedEntities.map((e) => e.entityType).join(", ")} deleted`;

  return await this.create({
    action: "DELETE",
    entities: formattedEntities,
    description: logDescription,
    previousState,
    users: formatUsers(users),
    details,
    level,
  });
};

logSchema.statics.logError = async function ({
  users,
  entities,
  entityType,
  entityId,
  error,
  details = {},
  description,
  level = "ERROR",
}) {
  // Handle both new (entities) and old (entityType + entityId) parameter styles
  const formattedEntities = entities
    ? formatEntities(entities)
    : entityType && entityId
      ? formatEntities({ entityType, entityId })
      : [];

  const errorDetails = {
    ...details,
    name: error?.name,
    stack: error?.stack,
  };

  // Generate description if not provided
  const logDescription = description || error?.message || "An error occurred";

  return await this.create({
    action: "ERROR",
    entities: formattedEntities,
    description: logDescription,
    users: formatUsers(users),
    details: errorDetails,
    level,
  });
};

const Log = mongoose.model("Log", logSchema);

module.exports = Log;
