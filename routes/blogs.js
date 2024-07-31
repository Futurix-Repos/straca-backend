const express = require("express");
const router = express.Router();
const Blog = require("../models/blogModel");
const BlogCategory = require("../models/blogTypeModel");
const User = require("../models/userModel");

const mongoose = require("mongoose");
const multer = require("multer");
const { authorizeJwt, verifyAccount, authorizePublic} = require("../helpers/verifyAccount");
const imageUploadHelper = require("../helpers/imageUploadHelper");
const upload = multer({storage: multer.memoryStorage()});

// GET /blogs - Get all blogs
router.get(
    "/",
    authorizeJwt,
    verifyAccount([{ name: "blogs", action: "read" }]),
    async (req, res) => {
        const match = {};
        const search = req.query.search;
        const category = req.query.category;

        let aggregationPipeline = [];

        aggregationPipeline = aggregationPipeline.concat([{
            $lookup: {
                from: BlogCategory.collection.name,
                localField: 'category',
                foreignField: '_id',
                as: 'category'
            }
        }, { $unwind: '$category' },]);

        aggregationPipeline = aggregationPipeline.concat([{
            $lookup: {
                from: User.collection.name,
                localField: 'createdBy',
                foreignField: '_id',
                as: 'creator'
            }
        }, { $unwind: '$creator' },]);

        if (category) {
            match['category.slug'] = category;
        }

        if (search) {
            match.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { 'creator.email': { $regex: search, $options: 'i' } }
            ];
        }

        if (Object.keys(match).length > 0) {
            aggregationPipeline.push({ $match: match });
        }

        aggregationPipeline.push({
            $project: {
                title: 1,
                description: 1,
                status: 1,
                image: 1,
                slug: 1,
                createdAt: 1,
                updatedAt: 1,
                category: {
                    _id: '$category._id',
                    label: '$category.label',
                    slug: '$category.slug'
                },
                createdBy: {
                    _id: '$creator._id',
                    email: '$creator.email'
                }
            }
        });



        try {
            const blogs = await Blog.aggregate(aggregationPipeline);


            res.status(200).json(blogs);
        } catch (error) {
            console.error(error.message);
            res.status(500).json({ message: error.message });
        }
    }
);

// GET /blogs - Get all blogs for public
router.get(
  "/public",
  authorizePublic(process.env.PUBLIC_TOKEN),
  async (req, res) => {
      const match = {status: "published"};
      const search = req.query.search;
      const category = req.query.category;

      let aggregationPipeline = [];

      aggregationPipeline = aggregationPipeline.concat([{
          $lookup: {
              from: 'blogcategories',
              localField: 'category',
              foreignField: '_id',
              as: 'category'
          }
      }, { $unwind: '$category' },]);

      aggregationPipeline = aggregationPipeline.concat([{
          $lookup: {
              $lookup: {
                  from: 'users',
                  localField: 'createdBy',
                  foreignField: '_id',
                  as: 'creator'
              }
          }
      }, { $unwind: '$creator' },]);

      if (category) {
          match['category.slug'] = category;
      }

      if (search) {
          match.$or = [
              { title: { $regex: search, $options: 'i' } },
              { description: { $regex: search, $options: 'i' } },
              { 'creator.email': { $regex: search, $options: 'i' } }
          ];
      }




      if (Object.keys(match).length > 0) {
          aggregationPipeline.push({ $match: match });
      }

      aggregationPipeline.push({
          $project: {
              title: 1,
              description: 1,
              image: 1,
              slug: 1,
              createdAt: 1,
              updatedAt: 1,
              category: {
                  label: '$category.label',
                  slug: '$category.slug'
              },
              createdBy: {
                  firstName: '$creator.firstName',
                  lastName: '$creator.lastName'
              }
          }
      });



      try {
          const blogs = await Blog.aggregate(aggregationPipeline);

          res.status(200).json({blogs});
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

// GET /blogs/:id - Get a specific blog by ID
router.get(
    "public/:id",
    authorizePublic(process.env.PUBLIC_TOKEN),

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
