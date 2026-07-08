const mongoose = require('mongoose');

const MenuItemSchema = new mongoose.Schema({
    label:  String,
    url:    String,
    target: { type: String, default: '_self' },
    order:  { type: Number, default: 0 },
}, { _id: false });

const MenuSchema = new mongoose.Schema({
    name:  { type: String, required: true },
    slug:  { type: String, required: true, unique: true },
    items: [MenuItemSchema],
}, { timestamps: true });

module.exports = mongoose.model('Menu', MenuSchema);
