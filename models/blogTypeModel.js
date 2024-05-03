const mongoose = require('mongoose');
const blogCategorySchema = mongoose.Schema(
    {
        label: {
            type: String,
            required: true,
        },
        description: {
            type: String,
        }
    },
    {
        timestamps: true
    }
)
const blogCategory = mongoose.model('blogCategory', blogCategorySchema);
module.exports = blogCategory;