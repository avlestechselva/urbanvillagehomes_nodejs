const mongoose = require('mongoose');

const PageSchema = new mongoose.Schema({
    title:            { type: String, required: true },
    slug:             { type: String, unique: true, index: true },
    excerpt:          String,
    body:             String,
    image:            String,
    status:           { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' },
    meta_description: String,
    meta_keywords:    String,
}, { timestamps: true });

module.exports = mongoose.model('Page', PageSchema);
