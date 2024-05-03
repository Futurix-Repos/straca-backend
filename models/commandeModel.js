const mongoose = require('mongoose');

const statusEnum = ["En attente de confirmation", "Confirmation de réception", "En transit", "Commande arrivée", "Commande livré"];

const commandeSchema = new mongoose.Schema(
    {
        trackingId: {
            type: String,
            required: true
        },
        typeColis: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'PackageType',
            required: true
        },
        transportType: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'TransportType',
            required: true
        },
        client: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Client',
            required: true
        },
        pricing: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Pricing',
            required: false,
        },
        description: {
            type: String,
            required: true
        },
        unit: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'MeasureUnit',
            required: true
        },
        pays: {
            type: String,
            required: true
        },
        quantity: {
            type: Number,
            required: true,
            min: [1, 'Quantity must be greater than 0']
        },
        ville: {
            type: String,
            required: true
        },
        status: {
            type: String,
            required: true,
            validate: {
                validator: function (value) {
                    return statusEnum.includes(value); // Check if the value exists in the statusEnum array
                },
                message: props => `${props.value} is not a valid status!`
            }
        },
        paymentStatus: {
            type: String,
            enum: ["paid", "unpaid"],
            default: "unpaid",
            required: true,
        },
        specialNote: {
            type: String,
            required: true
        }
    },
    {
        timestamps: true
    }
);

const Commande = mongoose.model('Commande', commandeSchema);

module.exports = Commande;