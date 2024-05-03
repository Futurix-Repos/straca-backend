const  mongoose = require('mongoose');
const vehicleBrandSchema = mongoose.Schema(
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
const VehicleBrand = mongoose.model('VehicleBrand' , vehicleBrandSchema);
module.exports = VehicleBrand;