const mongoose = require("mongoose");
const { ORDER_STATUS } = require("../helpers/constants");

const extraSchema = {
  type: {
    type: String,
    enum: ["RISE", "DISCOUNT"],
  },
  value: {
    type: Number,
    min: 0,
    validate: {
      validator: function (v) {
        if (!this.type) return true; // if no type is set, skip validation
        if (this.type === "RISE") return v <= 1000;
        if (this.type === "DISCOUNT") return v <= 100;
        return true;
      },
      message: (props) => {
        if (props.value.type === "RISE") {
          return `Value must be less than or equal to 1000 for RISE type`;
        }
        return `Value must be less than or equal to 100 for DISCOUNT type`;
      },
    },
  },
};

// Define the order item schema
const orderItemSchema = new mongoose.Schema({
  productMeasureUnit: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ProductMeasureUnit",
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 0,
  },
  totalAmount: {
    type: Number,
    required: true,
    min: 0,
  },
  extra: extraSchema, // now optional
});

const addressSchema = {
  name: { type: String, required: true },
  location: {
    type: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
    },
    required: true,
  },
};

orderItemSchema.pre(["save", "findByIdAndUpdate"], async function (next) {
  try {
    // Get the product measure unit price
    const productMeasureUnit = await mongoose
      .model("ProductMeasureUnit")
      .findById(this.productMeasureUnit);
    if (!productMeasureUnit) {
      throw new Error(
        `ProductMeasureUnit with ID ${this.productMeasureUnit} not found`,
      );
    }

    // Calculate base total amount
    let itemTotal = productMeasureUnit.amount * this.quantity;

    // Apply extra if it exists
    if (this.extra && this.extra.type && this.extra.value) {
      if (this.extra.type === "RISE") {
        itemTotal += (itemTotal * this.extra.value) / 100;
      } else if (this.extra.type === "DISCOUNT") {
        itemTotal -= (itemTotal * this.extra.value) / 100;
      }
    }

    this.totalAmount = itemTotal;
    next();
  } catch (error) {
    next(error);
  }
});

const orderSchemaNew = new mongoose.Schema(
  {
    reference: {
      type: String,
      required: true,
      unique: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(ORDER_STATUS),
      default: ORDER_STATUS.INITIATED,
      required: true,
    },
    description: {
      type: String,
    },
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      validate: {
        validator: async function (userId) {
          const User = mongoose.model("User");
          const user = await User.findById(userId);
          return user && user.type === "client";
        },
        message: "Sender must be an admin or employee",
      },
    },
    arrivalAddress: addressSchema,
    items: [orderItemSchema],
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      validate: {
        validator: async function (userId) {
          const User = mongoose.model("User");
          const user = await User.findById(userId);
          return user && (user.type === "admin" || user.type === "employee");
        },
        message: "Sender must be an admin or employee",
      },
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      validate: {
        validator: async function (userId) {
          const User = mongoose.model("User");
          const user = await User.findById(userId);
          return user && (user.type === "admin" || user.type === "employee");
        },
        message: "Sender must be an admin or employee",
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Add validation to ensure endDate is after startDate
orderSchemaNew.pre(["save", "findByIdAndUpdate"], function (next) {
  if (this.endDate < this.startDate) {
    next(new Error("End date must be after start date"));
  }
  next();
});

// Add middleware to calculate total order amount from items
// Calculate total order amount from items
orderSchemaNew.pre(["validate"], async function (next) {
  try {
    if (this.items && this.items.length > 0) {
      // Ensure all items have their totalAmount calculated
      await Promise.all(this.items.map((item) => item.save()));

      // Sum up all item totals
      this.totalAmount = this.items.reduce(
        (sum, item) => sum + (item.totalAmount || 0),
        0,
      );
    } else {
      this.totalAmount = 0;
    }
    next();
  } catch (error) {
    next(error);
  }
});

orderSchemaNew.pre(["validate"], async function (next) {
  try {
    if (this.items && this.items.length > 0) {
      const productIds = new Set();

      for (const item of this.items) {
        // Find and populate the productMeasureUnit
        const productMeasureUnit = await mongoose
          .model("ProductMeasureUnit")
          .findById(item.productMeasureUnit)
          .populate("product");

        if (!productMeasureUnit) {
          return next(
            new Error(
              `ProductMeasureUnit with ID ${item.productMeasureUnit} not found`,
            ),
          );
        }

        // Calculate base total amount
        let itemTotal = productMeasureUnit.amount * item.quantity;

        // Apply extra if it exists
        if (item.extra && item.extra.type && item.extra.value) {
          if (item.extra.type === "RISE") {
            itemTotal += (itemTotal * item.extra.value) / 100;
          } else if (item.extra.type === "DISCOUNT") {
            itemTotal -= (itemTotal * item.extra.value) / 100;
          }
        }

        // Update the totalAmount of the item
        item.totalAmount = itemTotal;

        // Check for duplicate products
        const productId = productMeasureUnit.product.toString();
        if (productIds.has(productId)) {
          return next(
            new Error(
              `Duplicate product detected in order: Product ID ${productId}`,
            ),
          );
        }

        productIds.add(productId);
      }
    }

    next();
  } catch (error) {
    next(error);
  }
});

orderSchemaNew.virtual("deliveries", {
  ref: "Delivery",
  localField: "_id",
  foreignField: "order",
});

const Order = mongoose.model("Order", orderSchemaNew);

module.exports = Order;
