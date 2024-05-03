const mongoose = require('mongoose');
const countryTypeSchema = mongoose.Schema(
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
module.exports = mongoose.model('CountryType', countryTypeSchema); 