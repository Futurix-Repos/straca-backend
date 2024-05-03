const mongoose = require('mongoose');

const measureUnitSchema = mongoose.Schema(
    {
        _id: mongoose.Schema.Types.ObjectId,
        label: { type: String, required: true },
        description: { type: String, required: true }
    },
    {
        timestamps: true
    },
);

module.exports = mongoose.model('MeasureUnit', measureUnitSchema); 