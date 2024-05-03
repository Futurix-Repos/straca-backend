const mongoose = require('mongoose');

const packageTypeSchema = mongoose.Schema(
    {
        _id: mongoose.Schema.Types.ObjectId,
        label: { type: String, required: true },
        description: { type: String, required: true }
    },
    {
        timestamps: true
    },
);

module.exports = mongoose.model('PackageType', packageTypeSchema); 