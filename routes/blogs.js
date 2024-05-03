const express = require("express");
const router = express.Router();
const Blog = require("../models/blogModel");

const mongoose = require("mongoose");
const multer = require("multer");
const { authorizeJwt, verifyAccount } = require("../helpers/verifyAccount"); 
const imageUploadHelper = require("../helpers/imageUploadHelper");
const upload = multer({storage: multer.memoryStorage()});
// GET /blogs - Get all blogs
router.get(
  "/",
  authorizeJwt,
  verifyAccount([{ name: "blogs", action: "read" }]),
  async (req, res) => {
    const filter = {};
    const search = req.query.search;

    if (search) {
      filter.$or = [
        { editor: { $regex: search, $options: "i" } },
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    try {
      const blog = await Blog.find(filter).populate("createdBy");
      res.status(200).json(blog);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: error.message });
    }
  }
);

// GET /blogs/:id - Get a specific blog by ID
router.get(
  "/:id",
  authorizeJwt,
  verifyAccount([{ name: "blog", action: "read" }]),
  
  async (req, res) => {
    try {
      const { id } = req.params;
      const blog = await Blog.findById(id);

      if (!blog) {
        return res
          .status(404)
          .json({ message: `Blog with ID ${id} not found` });
      }

      res.status(200).json(blog);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: error.message });
    }
  }
);

// POST /blog - Create a new blog
router.post(
  "/",
  authorizeJwt,
  verifyAccount([{ name: "blog", action: "create" }]),
  upload.single("file"),
  async (req, res) => {
    try {
      // Check if an image file is included in the request
      if (!req.file) {
        return res.status(400).json({ message: "Image file is required" });
      }

      // Upload the image file
      const imageUrl = await imageUploadHelper(req.file);
``
      // Generate a new ObjectId for the _id field
      const newId = new mongoose.Types.ObjectId();

      // Assign the generated _id and imageUrl to req.body
      req.body._id = newId;
      req.body.image = imageUrl;
      

      // Create the blog with the provided data
      const blog = await Blog.create(req.body);
      res.status(201).json(blog);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: error.message });
    }
  }
);

// PUT /blog/:id - Update a blog by ID
router.put(
  "/:id",
  authorizeJwt,
  verifyAccount([{ name: "blog", action: "update" }]),
  upload.single("file"),
  async (req, res) => {
    try {
      const { id } = req.params;

      let editedBlog = {...req.body};

      // Upload the image file
      console.log(req.body);
      // console.log(`file===>${req.file}`);
      // console.log(`buffer===>${req.file.buffer}`);
      if (req.file) {
        const imageUrl = await imageUploadHelper(req.file);
        // console.log(`\n\nImagURL -> ${imageUrl}\n\n`);
        editedBlog.image = imageUrl;
      }

      const blog = await Blog.findByIdAndUpdate(id, editedBlog, { new: true });

      if (!blog) {
        return res
          .status(404)
          .json({ message: `Cannot find any blog with ID ${id}` });
      }

      res.status(200).json(blog);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: error.message });
    }
  }
);

// DELETE /blog/:id - Delete a blog by ID
router.delete(
  "/:id",
  authorizeJwt,
  verifyAccount([{ name: "blog", action: "delete" }]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const blog = await Blog.findByIdAndDelete(id);

      if (!blog) {
        return res
          .status(404)
          .json({ message: `Cannot find any blog with ID ${id}` });
      }

      res.status(200).json(blog);
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: error.message });
    }
  }
);

module.exports = router;
