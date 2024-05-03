const mongoose = require('mongoose');

const proximitySchema = new mongoose.Schema(
    {
        label: {
            type: String,
            required: true,
        },
        description: {
            type: String,
            required: true,
        }
    },
    {
        timestamps: true,
    }
);

const Proximity = mongoose.model('Proximity', proximitySchema);

module.exports = Proximity;