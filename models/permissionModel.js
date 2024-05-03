const mongoose = require('mongoose');
const {validPermissionNames} = require("../helpers/constants");

const validActions = ['read', 'update', 'delete', 'create'];

const permissionSchema = mongoose.Schema(
    {
        _id: mongoose.Schema.Types.ObjectId,
        name: {
            type: String,
            required: true,
            validate: {
                validator: function (value) {
                    return validPermissionNames.includes(value);
                },
                message: 'Name is not correct'
            }
        },
        description: {
            type: String,
        },
        action: {
            type: String,
            validate: {
                validator: function (action) {
                    return  validActions.includes(action);
                },
                message: 'At least one valid action is required: read, update, delete, create',
            },
        },
    },
    {
        timestamps: true
    },);

module.exports = mongoose.model('Permission', permissionSchema);