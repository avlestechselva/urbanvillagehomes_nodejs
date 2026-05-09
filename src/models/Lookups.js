const mongoose = require('mongoose');

const PropertyTypeSchema = new mongoose.Schema({
    group_id:   String,
    department: String,
    type:       String,
});
const PropertyAvailabilitySchema = new mongoose.Schema({
    group_id:   String,
    department: String,
    name:       String,
});
const ResidentialPropertyStyleSchema = new mongoose.Schema({
    style_id:   String,
    style_name: String,
});
const RentFrequencySchema = new mongoose.Schema({
    id:             String,
    frequency_type: String,
});
const LifeMagazineSchema = new mongoose.Schema({
    title:       String,
    image:       String,
    pdf:         String,
    description: String,
    status:      { type: Number, default: 1 },
}, { timestamps: true });

module.exports = {
    PropertyType:              mongoose.model('PropertyType', PropertyTypeSchema),
    PropertyAvailability:      mongoose.model('PropertyAvailability', PropertyAvailabilitySchema),
    ResidentialPropertyStyle:  mongoose.model('ResidentialPropertyStyle', ResidentialPropertyStyleSchema),
    RentFrequency:             mongoose.model('RentFrequency', RentFrequencySchema),
    LifeMagazine:              mongoose.model('LifeMagazine', LifeMagazineSchema),
};
