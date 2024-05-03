const  mongoose = require('mongoose');
const vehicleTypeSchema = mongoose.Schema(
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
    timestamp: true,
}
)
const VehicleType = mongoose.model('VehicleType' , vehicleTypeSchema);
module.exports = VehicleType;