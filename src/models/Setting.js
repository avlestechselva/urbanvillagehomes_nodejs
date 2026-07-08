const mongoose = require('mongoose');

const SettingSchema = new mongoose.Schema({
    key:   { type: String, required: true, unique: true },
    value: { type: String, default: '' },
    label: { type: String, required: true },
    type:  { type: String, enum: ['text', 'textarea', 'image'], default: 'text' },
    group: { type: String, default: 'General' },
    order: { type: Number, default: 0 },
});

module.exports = mongoose.model('Setting', SettingSchema);
