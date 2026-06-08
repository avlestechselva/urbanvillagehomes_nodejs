#!/usr/bin/env node
/**
 * Upload post images from local backup to Cloudinary
 * and update MongoDB post records with new URLs
 */
const fs   = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const cloudinary = require('../src/config/cloudinary');
const MONGO_URI  = process.env.MONGO_URI;
const POSTS_DIR  = path.join(process.env.HOME, 'Downloads/urbanvillagehomes2/storage/app/public/posts');

function uploadToCloudinary(filePath, publicId) {
    return new Promise((resolve, reject) => {
        cloudinary.uploader.upload(filePath, {
            public_id:     publicId,
            resource_type: 'image',
            overwrite:     false,
        }, (err, result) => {
            if (err) return reject(err);
            resolve(result.secure_url);
        });
    });
}

async function main() {
    const client = new MongoClient(MONGO_URI);
    await client.connect();
    const db = client.db();

    // Get all posts with local image paths
    const posts = await db.collection('posts').find({ image: { $exists: true, $ne: null } }).toArray();
    console.log(`Found ${posts.length} posts with images\n`);

    let updated = 0, skipped = 0, failed = 0;

    for (const post of posts) {
        if (!post.image || post.image.startsWith('http')) { skipped++; continue; }

        const localPath = path.join(POSTS_DIR, post.image.replace(/^posts\//, ''));
        if (!fs.existsSync(localPath)) {
            console.log(`  [MISSING] ${post.image}`);
            failed++;
            continue;
        }

        try {
            const publicId = `urbanvillagehomes/posts/${post.image.replace(/^posts\//, '').replace(/\.[^.]+$/, '')}`;
            const url = await uploadToCloudinary(localPath, publicId);
            await db.collection('posts').updateOne(
                { _id: post._id },
                { $set: { image: url } }
            );
            console.log(`  [OK] ${post.title?.slice(0, 50)}`);
            updated++;
        } catch (err) {
            console.error(`  [ERR] ${post.title?.slice(0, 50)}: ${err.message}`);
            failed++;
        }
    }

    console.log(`\nDone! Updated: ${updated}, Skipped: ${skipped}, Failed: ${failed}`);
    await client.close();
}

main().catch(err => { console.error(err.message); process.exit(1); });
