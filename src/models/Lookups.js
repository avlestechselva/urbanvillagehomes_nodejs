const mongoose = require('mongoose');

const PropertyTypeSchema = new mongoose.Schema({
    group_id:   Number,
    department: String,
    type:       String,
});
const PropertyAvailabilitySchema = new mongoose.Schema({
    group_id:   Number,
    department: String,
    name:       String,
});
const ResidentialPropertyStyleSchema = new mongoose.Schema({
    style_id:   Number,
    style_name: String,
});
const RentFrequencySchema = new mongoose.Schema({
    id:             Number,
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
    PropertyType:             mongoose.model('PropertyType',             PropertyTypeSchema,             'property_types'),
    PropertyAvailability:     mongoose.model('PropertyAvailability',     PropertyAvailabilitySchema,     'property_availabilities'),
    ResidentialPropertyStyle: mongoose.model('ResidentialPropertyStyle', ResidentialPropertyStyleSchema, 'residential_property_styles'),
    RentFrequency:            mongoose.model('RentFrequency',            RentFrequencySchema,            'rent_frequencies'),
    LifeMagazine:             mongoose.model('LifeMagazine',             LifeMagazineSchema,             'life_magazines'),
};
