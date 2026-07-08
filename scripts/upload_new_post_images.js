/**
 * Upload new post images (2024-2026) to Cloudinary and update MongoDB
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose  = require('mongoose');
const cloudinary = require('../src/config/cloudinary');
const path      = require('path');
const fs        = require('fs');
const Post      = require('../src/models/Post');

const EXTRACTED_DIR = path.join(process.env.HOME, 'Downloads/posts_extracted');

async function run() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Get posts with local relative image paths (not yet on Cloudinary)
    const posts = await Post.find({ image: /^posts\// }).select('title image');
    console.log(`Posts needing image upload: ${posts.length}`);

    let uploaded = 0, skipped = 0, failed = 0;

    for (const post of posts) {
        // e.g. posts/October2024/2eOLjpb3SxxvcD09DDM9.png
        const parts = post.image.split('/'); // ['posts', 'October2024', 'filename.png']
        if (parts.length < 3) { skipped++; continue; }

        const monthFolder = parts[1]; // e.g. October2024
        const filename    = parts[2]; // e.g. 2eOLjpb3SxxvcD09DDM9.png
        const localPath   = path.join(EXTRACTED_DIR, monthFolder, filename);

        if (!fs.existsSync(localPath)) {
            console.log(`  ✗ File not found: ${localPath}`);
            failed++;
            continue;
        }

        try {
            const result = await cloudinary.uploader.upload(localPath, {
                folder: 'posts',
                public_id: path.parse(filename).name,
                overwrite: false,
            });
            await Post.updateOne({ _id: post._id }, { $set: { image: result.secure_url } });
            console.log(`  ✓ ${post.title.slice(0, 50)} → ${result.secure_url}`);
            uploaded++;
        } catch (err) {
            console.error(`  ✗ ${post.title.slice(0, 50)}: ${err.message}`);
            failed++;
        }
    }

    console.log(`\nDone. Uploaded: ${uploaded}, Skipped: ${skipped}, Failed: ${failed}`);
    await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });
