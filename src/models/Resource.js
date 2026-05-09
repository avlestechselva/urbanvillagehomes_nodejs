const mongoose = require('mongoose');

const ResourceSchema = new mongoose.Schema({
    propertyID: { type: String, index: true },
    modified:   String,
    url:        String,
    type:       { type: String, enum: ['image', 'floorplan', 'epcGraph', 'brochure'] },
    path:       String, // direct Jupix image URL
    sort_order: Number,
}, { timestamps: true });

ResourceSchema.index({ propertyID: 1, type: 1 });
ResourceSchema.index({ propertyID: 1, url: 1, type: 1 });

module.exports = mongoose.model('Resource', ResourceSchema);
