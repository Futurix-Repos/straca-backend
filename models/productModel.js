const mongoose = require('mongoose');

const productSchema = mongoose.Schema(
    {
        _id: mongoose.Schema.Types.ObjectId,
        name: { type: String, required: true },
        description: { type: String, required: true },
        price: {type: Number, required: true, min: 1},
        quantity: {type: Number, required: true}
    },
    {
        timestamps: true
    },
);

module.exports = mongoose.model('Product', productSchema);