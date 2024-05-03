const mongoose = require('mongoose');

const contractTypeSchema = new mongoose.Schema(
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

const ContractType = mongoose.model('ContractType', contractTypeSchema);

module.exports = ContractType;