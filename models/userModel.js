const mongoose = require('mongoose');

const validUserTypes = ['admin', 'employee', 'client'];

const userSchema = mongoose.Schema(
    {
        _id: mongoose.Schema.Types.ObjectId,
        firstName: {
            type: String,
            required: function () {
                return this.type !== 'admin';
            }
        },
        lastName: {
            type: String,
            required: function () {
                return this.type !== 'admin';
            }
        },
        phone: {
            type: String,
            required: function () {
                return this.type !== 'admin';
            }
        },
        address: {
            type: String,
        },
        type: {
            type: String,
            required: true,
            validate: {
                validator: function (value) {
                    return validUserTypes.includes(value);
                },
                message: 'Type must be either admin, employee, or client'
            }
        },
        email: {
            type: String,
            required: true,
            unique: true,
            match: /[a-z0-9!#$%'*+/=?^_`{|}~-]+(?:\.[a-z09!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/
        },
        password: { type: String, required: true },
        permissions: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Permission',
        }],
    },
    {
        timestamps: true
    },);

module.exports = mongoose.model('User', userSchema); 