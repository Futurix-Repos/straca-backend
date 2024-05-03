const mongoose = require('mongoose')

const employeeSchema = mongoose.Schema(
    {
        _id: mongoose.Schema.Types.ObjectId,
        firstName: {
            type: String,
            required: [true, "Please enter employee first name"]
        },
        lastName: {
            type: String,
            required: [true, "Please enter employee last name"]
        },
        email: {
            type: String,
            required: [true, "Please enter employee email"]
        },
        phone: {
            type: String,
            required: [true, "Please enter employee phone number"]
        },
       
        password: { type: String, required: true },
        title: { type: String, required: true },
    
    },
    {
        timestamps: true
    },
)

const Employee = mongoose.model('Employee', employeeSchema);

module.exports = Employee;