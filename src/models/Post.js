const mongoose = require('mongoose');

const PostSchema = new mongoose.Schema({
    title:            { type: String, required: true },
    slug:             { type: String, index: true },
    excerpt:          String,
    body:             String,
    image:            String,
    category:         { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    author:           { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status:           { type: String, enum: ['PUBLISHED', 'DRAFT', 'PENDING'], default: 'DRAFT' },
    featured:         { type: Boolean, default: false },
    meta_description: String,
    meta_keywords:    String,
    seo_title:        String,
}, { timestamps: true });

module.exports = mongoose.model('Post', PostSchema);
