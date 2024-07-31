const mongoose = require('mongoose');
const slugify = require("slugify");
const blogCategorySchema = mongoose.Schema(
    {
        label: {
            type: String,
            required: true,
        },
        slug: {type: String, unique: true},
        description: {
            type: String,
        }
    },
    {
        timestamps: true
    }
)


blogCategorySchema.pre('save', function(next) {
    // Create a slug based on the blog category label
    this.slug = slugify(this.label, { lower: true });
    next();
});

const blogCategory = mongoose.model('blogCategory', blogCategorySchema);
module.exports = blogCategory;