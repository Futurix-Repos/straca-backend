const mongoose = require("mongoose");
const slugify = require("slugify");

const validCategories = ["actualités", "savoir-faire"];
const validStatuses = ["published", "drafted"];

const blogSchema = new mongoose.Schema(
  {
    _id: mongoose.Schema.Types.ObjectId,
    title: {
      type: String,
      required: true,
    },
      slug: {
        type: String,
          unique: true,
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
      category: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'blogCategory',
          required: true,
      },
  },
  {
    timestamps: true,
  }
);

blogSchema.pre('save', function(next) {
    // Create a slug based on the blog title
    this.slug = slugify(this.title, { lower: true });
    next();
});

const Blog = mongoose.model("Blog", blogSchema);

module.exports = Blog;
