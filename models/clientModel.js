const mongoose = require('mongoose')

const clientSchema = new mongoose.Schema(
    {
        _id: mongoose.Schema.Types.ObjectId,
        firstName: {
            type: String,
            required: [true, "Please enter client first name"]
        },
        lastName: {
            type: String,
            required: [true, "Please enter client last name"]
        },
        email: {
            type: String,
            required: [true, "Please enter client email"]
        },
        phone: {
            type: String,
            required: [true, "Please enter client phone number"]
        },
        address: {
            type: String,
        },
        company: {
            type: String,
        },
        password: { type: String, required: true },
      
    },
    {
        timestamps: true
    },
)

const Client = mongoose.model('Client', clientSchema);

module.exports = Client;