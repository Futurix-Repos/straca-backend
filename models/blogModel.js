const mongoose = require("mongoose");

const validCategories = ["actualités", "savoir-faire"];
const validStatuses = ["published", "drafted"];

const blogSchema = new mongoose.Schema(
  {
    _id: mongoose.Schema.Types.ObjectId,
    title: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      required: true,
      
    },
    image: {
      type: String,
      required: false,
    },
    description: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      default: "drafted",
      enum: validStatuses,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false
    },
  },
  {
    timestamps: true,
  }
);

const Blog = mongoose.model("Blog", blogSchema);

module.exports = Blog;
