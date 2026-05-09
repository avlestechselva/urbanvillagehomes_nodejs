const mongoose = require('mongoose');

const CategorySchema = new mongoose.Schema({
    name:   { type: String, required: true },
    slug:   { type: String, unique: true, index: true },
    parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    order:  { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Category', CategorySchema);
